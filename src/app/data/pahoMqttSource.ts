import { EQUIPMENT, MQTT, PHASES, PLANT, TAGS, TAG_ORDER, VALVES, VALVE_BY_ID, type TagId, type ValveId } from '../config/plant';
import { formatNumber } from '../lib/format';
import { PahoLink } from './pahoLink';
import { lotCode } from './simulator';
import type { BatchInfo, BatchStatus, Command, CommandResult, DataSource, PlcSnapshot, SourceHooks, ValveState } from './types';

/** Tag do processo como um todo, usada nos comandos START/STOP/emergência. */
const PROCESS_TAG = PLANT.equipmentId.replace('-', '_');

/** Valores aceitos na chave "processo" do JSON. */
const PROCESS_STATUS: Record<string, BatchStatus> = {
  aguardando: 'idle',
  automatico: 'running',
  parado: 'stopped',
  emergencia: 'emergency',
  concluido: 'completed',
};

/** Valores aceitos para válvulas e porta de visita. */
const OPEN_CLOSED: Record<string, ValveState> = { aberta: 'open', fechada: 'closed' };

const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clip = (text: string, max = 80) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** Parte final do tópico de um comando: <TAG>/<acao>. */
function commandPath(cmd: Command): string {
  switch (cmd.type) {
    case 'start': return `${PROCESS_TAG}/iniciar`;
    case 'stop': return `${PROCESS_TAG}/parar`;
    case 'emergency': return `${PROCESS_TAG}/emergencia`;
    case 'resetEmergency': return `${PROCESS_TAG}/rearmar`;
    case 'valve': return `${cmd.id}/${cmd.open ? 'abrir' : 'fechar'}`;
    case 'motor': return `${EQUIPMENT.motor.id}/${cmd.on ? 'ligar' : 'desligar'}`;
    case 'pump': return `${EQUIPMENT.pump.id}/${cmd.on ? 'ligar' : 'desligar'}`;
    case 'manway': return `${EQUIPMENT.manway.id}/${cmd.open ? 'abrir' : 'fechar'}`;
  }
}

/**
 * Fonte de dados MQTT (equipeDEV). A conexão Paho fica em PahoLink.
 *
 * - Leituras: assina <prefixo>dados. Cada mensagem é um JSON com só as tags que
 *   mudaram; o restante mantém o último valor recebido.
 * - Comandos: publica em <prefixo>cmd/<TAG>/<acao>. A tela só muda quando o novo
 *   estado chega em "dados" (quem decide é o CLP/ESP, não a IHM).
 */
export class PahoMqttSource implements DataSource {
  readonly kind = 'mqtt' as const;
  readonly reportsConnection = true;
  readonly dataTopic = MQTT.topicPrefix + 'dados';

  private readonly link = new PahoLink({
    topic: this.dataTopic,
    onMessage: (text) => this.onMessage(text),
    onStatus: (status) => this.hooks.onConnection?.(status),
    onEvent: (message) => this.event(message),
  });
  private listener: ((s: PlcSnapshot) => void) | null = null;
  private hooks: SourceHooks = {};

  // Último estado conhecido da planta
  private tags = Object.fromEntries(TAG_ORDER.map((t) => [t, NaN])) as Record<TagId, number>;
  private valves = Object.fromEntries(VALVES.map((v) => [v.id, 'closed'])) as Record<ValveId, ValveState>;
  private motorOn = false;
  private motorRpm = 0;
  private pumpOn = false;
  private manwayOpen = false;
  private batch: BatchInfo;
  private phaseStartedAt = Date.now();
  private updatedAt: Record<string, number> = {};

  constructor() {
    this.batch = {
      lot: lotCode(new Date()),
      status: 'stopped',
      phaseIndex: 0,
      phaseElapsedS: 0,
      phaseDurationsS: PHASES.map(() => null),
      startedAt: Date.now(),
    };
  }

  // ─── DataSource ──────────────────────────────────────────────────────────

  get clientId() {
    return this.link.clientId;
  }

  start(onSnapshot: (s: PlcSnapshot) => void, hooks: SourceHooks = {}) {
    this.listener = onSnapshot;
    this.hooks = hooks;
    this.link.start();
  }

  stop() {
    this.link.stop();
    this.listener = null;
  }

  async send(cmd: Command): Promise<CommandResult> {
    const topic = `${MQTT.topicPrefix}cmd/${commandPath(cmd)}`;
    const problem = this.link.publish(topic, JSON.stringify({ usuario: PLANT.operator, timestamp: new Date().toISOString() }));
    if (problem) return { ok: false, reason: problem };
    this.event(`Comando publicado em ${topic}`);
    return { ok: true };
  }

  // ─── Leituras ────────────────────────────────────────────────────────────

  private onMessage(text: string | null) {
    let data: unknown;
    try {
      if (text === null) throw new Error('não é UTF-8');
      data = JSON.parse(text);
    } catch {
      this.invalid(`JSON inválido (${clip(text ?? '') || 'vazio'})`);
      return;
    }
    if (!isObject(data)) {
      this.invalid('esperado um objeto JSON, ex.: {"TIT_100_01": 37.5}');
      return;
    }
    const entries = Object.entries(data);
    if (!entries.length) {
      this.invalid('objeto vazio, nenhuma tag');
      return;
    }

    const now = Date.now();
    const problems: string[] = [];
    let changed = false;
    for (const [key, value] of entries) {
      const problem = this.apply(key, value, now);
      if (problem) problems.push(`${clip(key, 30)}: ${problem}`);
      else changed = true;
    }
    if (problems.length) this.invalid(problems.join(' · '));
    if (changed) this.publish();
  }

  /** Aplica uma tag do JSON. Devolve o motivo da recusa, ou null se aplicou. */
  private apply(key: string, value: unknown, now: number): string | null {
    if (has(TAGS, key)) {
      const cfg = TAGS[key as TagId];
      if (typeof value !== 'number' || !Number.isFinite(value)) return 'esperado um número';
      if (value < cfg.rangeMin || value > cfg.rangeMax) {
        return `fora da escala (${formatNumber(cfg.rangeMin, 0)} a ${formatNumber(cfg.rangeMax, 0)} ${cfg.unit})`;
      }
      this.tags[key as TagId] = value;
    } else if (has(VALVE_BY_ID, key) || key === EQUIPMENT.manway.id) {
      const state = typeof value === 'string' ? OPEN_CLOSED[value.toLowerCase()] : undefined;
      if (!state) return 'esperado "aberta" ou "fechada"';
      if (key === EQUIPMENT.manway.id) this.manwayOpen = state === 'open';
      else this.valves[key as ValveId] = state;
    } else if (key === EQUIPMENT.motor.id || key === EQUIPMENT.pump.id) {
      const problem = this.applyDrive(key, value);
      if (problem) return problem;
    } else if (key === 'etapa') {
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > PHASES.length) {
        return `esperado um número inteiro de 1 a ${PHASES.length}`;
      }
      this.setPhase(value - 1, now);
    } else if (key === 'processo') {
      const status = typeof value === 'string' ? PROCESS_STATUS[value.toLowerCase()] : undefined;
      if (!status) return `esperado ${Object.keys(PROCESS_STATUS).map((k) => `"${k}"`).join(', ')}`;
      this.batch.status = status;
    } else {
      return 'tag desconhecida';
    }
    this.updatedAt[key] = now;
    return null;
  }

  /** Motor ou bomba: { "ligado": bool, "rpm": número } (campos opcionais, ao menos um). */
  private applyDrive(key: string, value: unknown): string | null {
    const format = 'esperado { "ligado": true/false, "rpm": número }';
    if (!isObject(value)) return format;
    const { ligado, rpm, ...rest } = value;
    const extra = Object.keys(rest)[0];
    if (extra !== undefined) return `campo desconhecido "${clip(extra, 20)}" · ${format}`;
    if (ligado === undefined && rpm === undefined) return format;
    if (ligado !== undefined && typeof ligado !== 'boolean') return '"ligado" deve ser true ou false';
    if (rpm !== undefined && (typeof rpm !== 'number' || !Number.isFinite(rpm) || rpm < 0 || rpm > MQTT.rpmMax)) {
      return `"rpm" fora da escala (0 a ${MQTT.rpmMax})`;
    }

    if (key === EQUIPMENT.pump.id) {
      // A IHM não mostra rotação da bomba: "rpm" é aceito e ignorado
      if (ligado !== undefined) this.pumpOn = ligado;
      return null;
    }
    if (ligado !== undefined) this.motorOn = ligado;
    if (rpm !== undefined) this.motorRpm = rpm;
    else if (ligado === false) this.motorRpm = 0;
    return null;
  }

  private setPhase(index: number, now: number) {
    const b = this.batch;
    if (index === b.phaseIndex) return;
    b.phaseDurationsS[b.phaseIndex] = (now - this.phaseStartedAt) / 1000;
    // A nova etapa e as seguintes ainda não foram executadas (vale também ao voltar etapas)
    for (let i = index; i < PHASES.length; i++) b.phaseDurationsS[i] = null;
    b.phaseIndex = index;
    this.phaseStartedAt = now;
  }

  private publish() {
    const now = Date.now();
    this.listener?.({
      timestamp: now,
      tags: { ...this.tags },
      valves: { ...this.valves },
      motorOn: this.motorOn,
      motorRpm: this.motorRpm,
      pumpOn: this.pumpOn,
      manwayOpen: this.manwayOpen,
      batch: { ...this.batch, phaseElapsedS: (now - this.phaseStartedAt) / 1000, phaseDurationsS: [...this.batch.phaseDurationsS] },
      updatedAt: { ...this.updatedAt },
    });
  }

  // ─── Histórico ───────────────────────────────────────────────────────────

  private invalid(detail: string) {
    this.event(`Mensagem MQTT inválida: ${clip(detail, 200)}`);
  }

  private event(message: string) {
    this.hooks.onEvent?.('MQTT', message);
  }
}
