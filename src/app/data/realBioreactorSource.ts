import { PHASES, REAL_EQUIPMENT, phaseLabel, TAGS, TAG_ORDER, VALVES, type TagId, type ValveId } from '../config/plant';
import { formatNumber } from '../lib/format';
import { PahoLink } from './pahoLink';
import type {
  BatchInfo,
  BatchStatus,
  Command,
  CommandResult,
  CommStatus,
  DataSource,
  PhaseCompletion,
  PlcSnapshot,
  SourceHooks,
  ValveState,
} from './types';

/** Compara nomes de chave sem acento, maiúsculas ou espaços nas pontas ("Produção" = "producao"). */
const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text);
/** Nome de chave padronizado: "AIT_100-01" → "AIT_100_01", espaços removidos. */
const cleanKey = (key: string) => key.replace(/-/g, '_').replace(/\s+/g, '');

const PRODUCTION_KEY = normalize(REAL_EQUIPMENT.productionKey);
const TAG_KEYS = new Map(
  Object.entries(REAL_EQUIPMENT.tagKeys).flatMap(([key, tag]) => (tag ? [[normalize(cleanKey(key)), tag] as const] : [])),
);

/** Nome curto do tópico nas mensagens do histórico. */
const topicName = (topic: string) => (topic === REAL_EQUIPMENT.analogTopic ? 'analógico' : 'de etapas');

/**
 * Payload como objeto ou lista de objetos (juntados num só). JSON que chega como
 * texto ("{\"a\":1}") é lido de novo. Lança erro se não for JSON; null = formato inesperado.
 */
function parsePayload(text: string): Record<string, unknown> | null {
  let data: unknown = JSON.parse(text);
  if (typeof data === 'string') data = JSON.parse(data);
  if (isObject(data)) return data;
  if (Array.isArray(data) && data.every(isObject)) return Object.assign({}, ...data);
  return null;
}

/**
 * Biorreator REAL (tópicos appiot, publicados por um servidor Node-RED), SOMENTE LEITURA.
 *
 * - Etapas e produção chegam uma chave por mensagem; o estado é acumulado.
 * - Etapas pelo NÚMERO no início da chave ("3_Check_Pressão_ok" → etapa 3); true = concluída.
 *   Etapa atual = primeira etapa false depois da última concluída.
 * - "Produção": true = em execução, false = parado.
 * - Variáveis analógicas no tópico /a (TIT, PIT, LIT, AIT), com watchdog próprio:
 *   sem mensagens nele, só os cards analógicos ficam "dado antigo".
 * - O histórico só registra MUDANÇAS (etapa concluída, produção iniciada…) e cada
 *   aviso (chave desconhecida, fora de escala…) uma única vez.
 * - Nunca publica: send() recusa e a conexão é criada somente leitura.
 */
export class RealBioreactorSource implements DataSource {
  readonly kind = 'equipamento' as const;
  readonly reportsConnection = true;
  readonly readOnlyReason = REAL_EQUIPMENT.readOnlyReason;
  readonly topic = REAL_EQUIPMENT.topic;
  readonly analogTopic = REAL_EQUIPMENT.analogTopic;
  /** Todas as chaves recebidas com o último valor, inclusive as desconhecidas. */
  readonly received = new Map<string, unknown>();

  private readonly link = new PahoLink({
    topics: [this.topic, this.analogTopic],
    readOnly: true,
    onMessage: (text, topic, retained) => this.onMessage(text, topic, retained),
    onStatus: (status) => this.onLinkStatus(status),
    onEvent: (message) => this.event(message),
  });
  private listener: ((s: PlcSnapshot) => void) | null = null;
  private hooks: SourceHooks = {};

  // Comunicação
  private linkStatus: CommStatus = 'connecting';
  private status: CommStatus = 'connecting';
  private connectedAt: number | null = null;
  /** Última mensagem de etapas/produção (watchdog da comunicação). */
  private lastMessageAt: number | null = null;
  /** Última mensagem no tópico analógico (watchdog separado, só para os cards analógicos). */
  private lastAnalogAt: number | null = null;
  private analogSilent = false;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  // Estado acumulado do equipamento
  private production: boolean | undefined;
  private productionStartedAt: number | null = null;
  private phaseDone: (boolean | undefined)[] = PHASES.map(() => undefined);
  private completion: (PhaseCompletion | null)[] = PHASES.map(() => null);
  private tags = Object.fromEntries(TAG_ORDER.map((t) => [t, NaN])) as Record<TagId, number>;
  private updatedAt: Record<string, number> = {};
  /** Tags cuja última leitura foi descartada, com o motivo (mostrado no card). */
  private rejected: Record<string, string> = {};
  /** Avisos já registrados (cada um aparece uma única vez no histórico). */
  private logged = new Set<string>();

  // Aquecimento: a tela só mostra o estado depois de um ciclo completo de chaves
  private firstMessageAt: number | null = null;
  private ready = false;
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;

  get clientId() {
    return this.link.clientId;
  }

  /** Hora da última mensagem de etapas/produção (a que decide "Sem dados do equipamento"). */
  get lastPhaseMessageAt() {
    return this.lastMessageAt;
  }

  // ─── DataSource ──────────────────────────────────────────────────────────

  start(onSnapshot: (s: PlcSnapshot) => void, hooks: SourceHooks = {}) {
    this.listener = onSnapshot;
    this.hooks = hooks;
    this.link.start();
    this.watchdog = setInterval(() => this.updateStatus(), 1000);
  }

  stop() {
    this.link.stop();
    if (this.watchdog) clearInterval(this.watchdog);
    if (this.warmupTimer) clearTimeout(this.warmupTimer);
    this.listener = null;
  }

  /** Equipamento real: nenhum comando é publicado. */
  async send(_cmd: Command): Promise<CommandResult> {
    return { ok: false, reason: this.readOnlyReason };
  }

  // ─── Comunicação ─────────────────────────────────────────────────────────

  private onLinkStatus(status: CommStatus) {
    this.linkStatus = status;
    if (status === 'online') {
      // Nova conexão: conta o silêncio a partir de agora
      this.connectedAt = Date.now();
      this.lastMessageAt = null;
      this.lastAnalogAt = null;
    }
    this.updateStatus();
  }

  /** Broker conectado + mensagens nos últimos silenceTimeoutS = online; sem mensagens = 'silent'. */
  private updateStatus() {
    const now = Date.now();
    this.updateAnalogStatus(now);
    let next: CommStatus = this.linkStatus;
    if (this.linkStatus === 'online') {
      const ref = this.lastMessageAt ?? this.connectedAt ?? now;
      if (now - ref > REAL_EQUIPMENT.silenceTimeoutS * 1000) next = 'silent';
      else next = this.lastMessageAt ? 'online' : 'connecting';
    }
    if (next === this.status) return;

    if (next === 'silent') {
      this.event(this.lastMessageAt
        ? `Sem mensagens do equipamento há mais de ${REAL_EQUIPMENT.silenceTimeoutS} s`
        : `Nenhuma mensagem do equipamento nos primeiros ${REAL_EQUIPMENT.silenceTimeoutS} s após conectar`);
    } else if (next === 'online' && this.status === 'silent') {
      this.event('Mensagens do equipamento retomadas');
    }
    this.status = next;
    this.hooks.onConnection?.(next);
  }

  /**
   * Watchdog do tópico analógico: só registra no histórico. Os cards ficam cinza
   * sozinhos, pela idade de cada valor (staleAfterS do snapshot).
   */
  private updateAnalogStatus(now: number) {
    if (this.linkStatus !== 'online') return;
    const ref = this.lastAnalogAt ?? this.connectedAt ?? now;
    const silent = now - ref > REAL_EQUIPMENT.analogSilenceTimeoutS * 1000;
    if (silent === this.analogSilent) return;
    this.analogSilent = silent;
    if (silent) {
      this.event(this.lastAnalogAt
        ? `Sem leituras analógicas há mais de ${REAL_EQUIPMENT.analogSilenceTimeoutS} s · valores marcados como dado antigo`
        : `Nenhuma leitura analógica nos primeiros ${REAL_EQUIPMENT.analogSilenceTimeoutS} s após conectar`);
    } else if (this.lastAnalogAt) {
      this.event('Leituras analógicas retomadas');
    }
  }

  // ─── Leituras ────────────────────────────────────────────────────────────

  private onMessage(text: string | null, topic: string, retained: boolean) {
    const now = Date.now();
    if (retained) {
      // O servidor do equipamento não retém mensagens: a retida é um valor antigo que alguém
      // guardou no broker (ex.: {"TIT_100_01": 58}) e daria alarme falso ao conectar
      this.once(`retida:${topic}`, `Mensagem retida ignorada no tópico ${topicName(topic)}: valor antigo guardado no broker`);
      return;
    }
    const analog = topic === this.analogTopic;
    if (analog) this.lastAnalogAt = now;
    else this.lastMessageAt = now;
    this.updateStatus();

    let data: Record<string, unknown> | null;
    try {
      if (text === null) throw new Error('não é UTF-8');
      data = parsePayload(text);
    } catch {
      this.once(`json:${topic}`, `Mensagem inválida no tópico ${topicName(topic)}: não é JSON`);
      return;
    }
    if (!data) {
      this.once(`objeto:${topic}`, `Mensagem inválida no tópico ${topicName(topic)}: esperado objeto ou lista JSON`);
      return;
    }

    const entries = Object.entries(data).map(([raw, value]) => {
      const key = cleanKey(raw);
      if (key !== raw) {
        const what = raw.includes('-') ? 'com hífen' : 'com espaços';
        this.once(`chave:${raw}`, `Chave "${raw}" chegou ${what}: lida como ${key}`);
      }
      return [key, value] as const;
    });

    if (!this.ready) {
      // Uma chave de etapa repetida = já vimos o ciclo completo: mostra o estado antes de aplicar
      // a repetição. O tópico analógico não conta (traz sempre as mesmas chaves e encerraria cedo
      // demais), mas inicia o prazo máximo, para a tela não esperar para sempre sem etapas.
      if (!analog && entries.some(([key]) => this.received.has(key))) this.endWarmup();
      else if (this.firstMessageAt === null) {
        this.firstMessageAt = now;
        this.warmupTimer = setTimeout(() => this.endWarmup(), REAL_EQUIPMENT.warmupS * 1000);
      }
    }

    for (const [key, value] of entries) {
      this.received.set(key, value);
      this.apply(key, value, now);
    }
    if (this.ready) this.publish();
  }

  private apply(key: string, value: unknown, now: number) {
    const match = REAL_EQUIPMENT.phaseKeyPattern.exec(key);
    const phase = match ? Number(match[1]) : NaN;
    if (phase >= 1 && phase <= PHASES.length) {
      if (typeof value !== 'boolean') {
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value), 20)} (esperado true ou false)`);
        return;
      }
      this.applyPhase(phase - 1, value, now);
      return;
    }

    const name = normalize(key);
    if (name === PRODUCTION_KEY) {
      if (typeof value !== 'boolean') {
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value), 20)} (esperado true ou false)`);
        return;
      }
      if (this.production !== undefined && this.production !== value) {
        this.event(value ? 'Produção iniciada' : 'Produção parada');
        if (value) this.productionStartedAt = now;
      }
      this.production = value;
      return;
    }

    const tag = TAG_KEYS.get(name);
    if (tag) {
      const cfg = TAGS[tag];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value), 20)} (esperado número)`);
        return;
      }
      if (value < cfg.rangeMin || value > cfg.rangeMax) {
        this.once(`escala:${key}`, `${tag} fora da escala: ${formatNumber(value, cfg.decimals)} ${cfg.unit} (escala ${formatNumber(cfg.rangeMin, 0)}–${formatNumber(cfg.rangeMax, 0)}) · leitura ignorada`);
        // O card não pode dizer "aguardando dados" se o equipamento está mandando
        this.rejected[tag] = `Fora da escala: ${formatNumber(value, cfg.decimals)} ${cfg.unit} recebido (escala ${formatNumber(cfg.rangeMin, 0)}–${formatNumber(cfg.rangeMax, 0)}) · leitura ignorada`;
        return;
      }
      // Valor completo (0 é válido); a tela arredonda pelas casas decimais do config
      delete this.rejected[tag];
      this.tags[tag] = value;
      this.updatedAt[tag] = now;
      return;
    }

    this.once(`novo:${key}`, `Campo novo recebido: ${key}`);
  }

  private applyPhase(index: number, done: boolean, now: number) {
    const prev = this.phaseDone[index];
    this.phaseDone[index] = done;
    if (prev === done) return;
    const label = `E${phaseLabel(index).slice(1)}`;
    if (done) {
      // Primeira vez já em true: a IHM não sabe a hora exata (observed = false)
      this.completion[index] = { at: now, observed: prev === false };
      if (prev === false) this.event(`${label} concluída`);
    } else {
      this.completion[index] = null;
      if (prev === true) this.event(`${label} voltou a não concluída`);
    }
  }

  private endWarmup() {
    if (this.ready) return;
    this.ready = true;
    if (this.warmupTimer) clearTimeout(this.warmupTimer);
    const batch = this.batchInfo(Date.now());
    // As etapas concluídas ficam implícitas: a atual é a primeira não concluída
    const production = this.production === undefined ? 'não informada' : this.production ? 'em execução' : 'parada';
    const phase = batch.status === 'completed' ? 'lote concluído' : `${phaseLabel(batch.phaseIndex)} em curso`;
    this.event(`Estado inicial: produção ${production} · ${phase}`);
    this.publish();
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────

  /**
   * Etapa atual = primeira etapa false depois da última concluída. Etapas ainda não
   * recebidas (ex.: 4 e 5) não seguram a sequência. Última etapa concluída = lote concluído.
   */
  private batchInfo(now: number): BatchInfo {
    const total = PHASES.length;
    let lastDone = 0;
    this.phaseDone.forEach((d, i) => {
      if (d === true) lastDone = i + 1;
    });
    let current = 0;
    for (let n = lastDone + 1; n <= total && !current; n++) if (this.phaseDone[n - 1] === false) current = n;
    const completed = !current && lastDone === total;
    if (!current) current = completed ? total : lastDone + 1;
    const index = current - 1;

    const status: BatchStatus = completed
      ? 'completed'
      : this.production === true ? 'running' : this.production === false ? 'stopped' : 'idle';

    // Durações só quando a IHM viu o início e o fim da etapa
    const durations = PHASES.map((_, i) => {
      const end = this.completion[i];
      const start = i > 0 ? this.completion[i - 1] : null;
      return end?.observed && start?.observed ? (end.at - start.at) / 1000 : null;
    });
    const previous = index > 0 ? this.completion[index - 1] : null;
    const phaseStart = previous?.observed ? previous.at : (this.firstMessageAt ?? now);

    return {
      lot: '', // o equipamento não informa o lote (cabeçalho: "Não informado")
      status,
      phaseIndex: index,
      phaseElapsedS: completed ? 0 : Math.max(0, (now - phaseStart) / 1000),
      phaseDurationsS: durations,
      startedAt: this.productionStartedAt ?? this.firstMessageAt ?? now,
      phaseCompletedAt: this.completion.map((c) => (c ? { ...c } : null)),
    };
  }

  private publish() {
    const now = Date.now();
    // O equipamento não informa válvulas, motor, bomba nem porta: ficam sem dado (cinza)
    const valves = Object.fromEntries(VALVES.map((v) => [v.id, 'closed'])) as Record<ValveId, ValveState>;
    this.listener?.({
      timestamp: now,
      tags: { ...this.tags },
      valves,
      motorOn: false,
      motorRpm: 0,
      pumpOn: false,
      manwayOpen: false,
      batch: this.batchInfo(now),
      updatedAt: { ...this.updatedAt },
      staleAfterS: REAL_EQUIPMENT.analogSilenceTimeoutS,
      rejected: { ...this.rejected },
    });
  }

  // ─── Histórico ───────────────────────────────────────────────────────────

  /** Registra um aviso uma única vez (sem repetir a cada mensagem). */
  private once(id: string, message: string) {
    if (this.logged.has(id)) return;
    this.logged.add(id);
    this.event(message);
  }

  private event(message: string) {
    this.hooks.onEvent?.('Equipamento', message);
  }
}
