import { EQUIPMENT, MQTT, PHASES, PLANT, TAGS, TAG_ORDER, VALVES, VALVE_BY_ID, type TagId, type ValveId } from '../config/plant';
import { formatNumber } from '../lib/format';
import { lotCode } from './simulator';
import type {
  BatchInfo,
  BatchStatus,
  Command,
  CommandResult,
  CommStatus,
  DataSource,
  PlcSnapshot,
  SourceHooks,
  ValveState,
} from './types';

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
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
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
 * Fonte de dados MQTT com a biblioteca Paho (public/vendor/mqttws31.js), no mesmo
 * padrão do exemplo do LED: Paho.MQTT.Client(host, porta, clientId) com useSSL.
 *
 * - Leituras: assina <prefixo>dados. Cada mensagem é um JSON com só as tags que
 *   mudaram; o restante mantém o último valor recebido.
 * - Comandos: publica em <prefixo>cmd/<TAG>/<acao>. A tela só muda quando o novo
 *   estado chega em "dados" (quem decide é o CLP/ESP, não a IHM).
 * - Conexão: reconecta sozinha com espera crescente (2, 4, 8, 16, 30 s…).
 */
export class PahoMqttSource implements DataSource {
  readonly kind = 'mqtt' as const;
  readonly reportsConnection = true;
  /** Ex.: "BR100-482913" (número somado ANTES de juntar ao texto, ao contrário do exemplo). */
  readonly clientId = MQTT.clientIdPrefix + (100_000 + Math.floor(Math.random() * 900_000));
  readonly dataTopic = MQTT.topicPrefix + 'dados';

  private client: PahoMQTT.Client | null = null;
  private status: CommStatus = 'connecting';
  /** Falhas seguidas de conexão (zera ao conectar). */
  private failures = 0;
  /** Incrementa a cada tentativa: callbacks de clientes antigos são ignorados. */
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
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

  start(onSnapshot: (s: PlcSnapshot) => void, hooks: SourceHooks = {}) {
    this.listener = onSnapshot;
    this.hooks = hooks;
    window.addEventListener('online', this.onBrowserOnline);
    this.connect();
  }

  stop() {
    this.generation += 1;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.onBrowserOnline);
    try {
      this.client?.disconnect();
    } catch {
      // já desconectado
    }
    this.client = null;
    this.listener = null;
  }

  async send(cmd: Command): Promise<CommandResult> {
    const paho = window.Paho?.MQTT;
    if (!paho || !this.client || this.status !== 'online') return { ok: false, reason: 'Sem conexão com o broker MQTT' };

    const topic = `${MQTT.topicPrefix}cmd/${commandPath(cmd)}`;
    const message = new paho.Message(JSON.stringify({ usuario: PLANT.operator, timestamp: new Date().toISOString() }));
    message.destinationName = topic;
    try {
      this.client.send(message);
    } catch (e) {
      return { ok: false, reason: `Falha ao publicar no broker: ${errorText(e)}` };
    }
    this.event(`Comando publicado em ${topic}`);
    return { ok: true };
  }

  // ─── Conexão ─────────────────────────────────────────────────────────────

  private connect() {
    this.retryTimer = null;
    const paho = window.Paho?.MQTT;
    if (!paho) {
      this.event('Biblioteca Paho MQTT não carregada (public/vendor/mqttws31.js)');
      this.setStatus('offline');
      return;
    }

    const gen = ++this.generation;
    const current = () => gen === this.generation;
    let client: PahoMQTT.Client;
    try {
      client = new paho.Client(MQTT.host, MQTT.port, this.clientId);
    } catch (e) {
      this.event(`Não foi possível criar o cliente MQTT: ${errorText(e)}`);
      this.setStatus('offline');
      return;
    }

    client.onConnectionLost = (err) => {
      if (!current()) return;
      this.client = null;
      this.scheduleReconnect(`Conexão com o broker perdida (${err.errorMessage || 'sem detalhe'})`);
    };
    client.onMessageArrived = (msg) => {
      if (current()) this.onMessage(msg);
    };

    this.client = client;
    try {
      client.connect({
        useSSL: MQTT.useSSL,
        timeout: MQTT.timeoutS,
        keepAliveInterval: MQTT.keepAliveS,
        cleanSession: true,
        onSuccess: () => {
          if (!current()) return;
          this.failures = 0;
          client.subscribe(this.dataTopic, {
            qos: 0,
            onFailure: (err) => this.event(`Falha ao assinar ${this.dataTopic}: ${err.errorMessage}`),
          });
          this.event(`Conectado a ${MQTT.host}:${MQTT.port} como ${this.clientId} · assinando ${this.dataTopic}`);
          this.setStatus('online');
        },
        onFailure: (err) => {
          if (!current()) return;
          this.client = null;
          this.scheduleReconnect(`Falha ao conectar em ${MQTT.host}:${MQTT.port} (${err.errorMessage || 'sem detalhe'})`);
        },
      });
    } catch (e) {
      this.client = null;
      this.scheduleReconnect(`Falha ao conectar: ${errorText(e)}`);
    }
  }

  /** Espera 2, 4, 8, 16 s… (até o máximo) e tenta de novo. No máximo, passa a "Offline". */
  private scheduleReconnect(reason: string) {
    this.failures += 1;
    const delayS = Math.min(MQTT.reconnectMinS * 2 ** (this.failures - 1), MQTT.reconnectMaxS);
    const next: CommStatus = delayS >= MQTT.reconnectMaxS ? 'offline' : 'reconnecting';

    // Registra só o início da queda e a passagem para offline (sem repetir a cada tentativa)
    if (this.failures === 1) this.event(`${reason} · nova tentativa em ${delayS} s`);
    else if (next === 'offline' && this.status !== 'offline') {
      this.event(`Sem conexão com o broker após ${this.failures} tentativas · nova tentativa a cada ${MQTT.reconnectMaxS} s`);
    }

    this.setStatus(next);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delayS * 1000);
  }

  /** A rede do computador voltou: a espera recomeça em 2 s e, se havia uma agendada, tenta já. */
  private onBrowserOnline = () => {
    if (this.status === 'online') return;
    this.failures = 0;
    if (!this.retryTimer) return; // tentativa em andamento: se falhar, a próxima já é em 2 s
    clearTimeout(this.retryTimer);
    this.connect();
  };

  private setStatus(status: CommStatus) {
    if (status === this.status) return;
    this.status = status;
    this.hooks.onConnection?.(status);
  }

  // ─── Leituras ────────────────────────────────────────────────────────────

  private onMessage(msg: PahoMQTT.Message) {
    let text = '';
    let data: unknown;
    try {
      text = msg.payloadString;
      data = JSON.parse(text);
    } catch {
      this.invalid(`JSON inválido (${clip(text) || 'vazio'})`);
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
