import { PHASES, REAL_EQUIPMENT, TAGS, TAG_ORDER, VALVES, type TagId, type ValveId } from '../config/plant';
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

const PRODUCTION_KEY = normalize(REAL_EQUIPMENT.productionKey);
const TAG_KEYS = new Map(
  Object.entries(REAL_EQUIPMENT.tagKeys).flatMap(([key, tag]) => (tag ? [[normalize(key), tag] as const] : [])),
);

/**
 * Biorreator REAL (tópico appiot, publicado por um servidor Node-RED), SOMENTE LEITURA.
 *
 * - Cada mensagem traz uma chave; o estado é acumulado (as outras chaves continuam).
 * - Etapas pelo NÚMERO no início da chave ("3_Check_Pressão_ok" → etapa 3); true = concluída.
 *   Etapa atual = primeira etapa false depois da última concluída.
 * - "Produção": true = em execução, false = parado.
 * - O histórico só registra MUDANÇAS (etapa concluída, produção iniciada…) e cada
 *   chave desconhecida uma única vez.
 * - Nunca publica: send() recusa e a conexão é criada somente leitura.
 */
export class RealBioreactorSource implements DataSource {
  readonly kind = 'equipamento' as const;
  readonly reportsConnection = true;
  readonly readOnlyReason = REAL_EQUIPMENT.readOnlyReason;
  readonly topic = REAL_EQUIPMENT.topic;
  /** Todas as chaves recebidas com o último valor, inclusive as desconhecidas. */
  readonly received = new Map<string, unknown>();

  private readonly link = new PahoLink({
    topic: this.topic,
    readOnly: true,
    onMessage: (text) => this.onMessage(text),
    onStatus: (status) => this.onLinkStatus(status),
    onEvent: (message) => this.event(message),
  });
  private listener: ((s: PlcSnapshot) => void) | null = null;
  private hooks: SourceHooks = {};

  // Comunicação
  private linkStatus: CommStatus = 'connecting';
  private status: CommStatus = 'connecting';
  private connectedAt: number | null = null;
  private lastMessageAt: number | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  // Estado acumulado do equipamento
  private production: boolean | undefined;
  private productionStartedAt: number | null = null;
  private phaseDone: (boolean | undefined)[] = PHASES.map(() => undefined);
  private completion: (PhaseCompletion | null)[] = PHASES.map(() => null);
  private tags = Object.fromEntries(TAG_ORDER.map((t) => [t, NaN])) as Record<TagId, number>;
  private updatedAt: Record<string, number> = {};
  /** Avisos já registrados (cada um aparece uma única vez no histórico). */
  private logged = new Set<string>();

  // Aquecimento: a tela só mostra o estado depois de um ciclo completo de chaves
  private firstMessageAt: number | null = null;
  private ready = false;
  private warmupTimer: ReturnType<typeof setTimeout> | null = null;

  get clientId() {
    return this.link.clientId;
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
    }
    this.updateStatus();
  }

  /** Broker conectado + mensagens nos últimos silenceTimeoutS = online; sem mensagens = 'silent'. */
  private updateStatus() {
    const now = Date.now();
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
        : `Nenhuma mensagem do equipamento em ${REAL_EQUIPMENT.silenceTimeoutS} s após conectar (o servidor Node-RED está publicando?)`);
    } else if (next === 'online' && this.status === 'silent') {
      this.event('Mensagens do equipamento retomadas');
    }
    this.status = next;
    this.hooks.onConnection?.(next);
  }

  // ─── Leituras ────────────────────────────────────────────────────────────

  private onMessage(text: string | null) {
    const now = Date.now();
    this.lastMessageAt = now;
    this.updateStatus();

    let data: unknown;
    try {
      if (text === null) throw new Error('não é UTF-8');
      data = JSON.parse(text);
    } catch {
      this.once('json', `Mensagem inválida do equipamento: JSON inválido (${clip(text ?? '') || 'vazio'})`);
      return;
    }
    if (!isObject(data)) {
      this.once('objeto', `Mensagem inválida do equipamento: esperado um objeto JSON, recebido ${clip(String(text))}`);
      return;
    }
    const entries = Object.entries(data);

    if (!this.ready) {
      // Uma chave repetida = já vimos o ciclo completo: mostra o estado antes de aplicar a repetição
      if (entries.some(([key]) => this.received.has(key))) this.endWarmup();
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
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value))} (esperado true ou false)`);
        return;
      }
      this.applyPhase(phase - 1, value, now);
      return;
    }

    const name = normalize(key);
    if (name === PRODUCTION_KEY) {
      if (typeof value !== 'boolean') {
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value))} (esperado true ou false)`);
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
        this.once(`tipo:${key}`, `Valor inesperado em "${key}": ${clip(JSON.stringify(value))} (esperado um número)`);
        return;
      }
      if (value < cfg.rangeMin || value > cfg.rangeMax) {
        this.once(`escala:${key}`, `Valor de "${key}" fora da escala (${formatNumber(cfg.rangeMin, 0)} a ${formatNumber(cfg.rangeMax, 0)} ${cfg.unit}): ignorado`);
        return;
      }
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
    const label = `Etapa ${index + 1} · ${PHASES[index].name}`;
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
    const done = this.phaseDone.flatMap((d, i) => (d ? [i + 1] : []));
    const production = this.production === undefined ? 'não informada' : this.production ? 'em execução' : 'parada';
    const phase = batch.status === 'completed' ? 'lote concluído' : `etapa atual ${batch.phaseIndex + 1} · ${PHASES[batch.phaseIndex].name}`;
    this.event(`Estado inicial do equipamento: produção ${production} · etapas concluídas: ${done.length ? done.join(', ') : 'nenhuma'} · ${phase}`);
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
      lot: '—',
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
