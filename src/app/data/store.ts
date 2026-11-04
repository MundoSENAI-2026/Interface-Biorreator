import {
  COMM_TIMEOUT_MS,
  EQUIPMENT,
  PHASES,
  PLANT,
  TAGS,
  TAG_ORDER,
  HISTORY_WINDOW_S,
  MQTT,
  VALVES,
  VALVE_BY_ID,
  getLimits,
  type TagId,
} from '../config/plant';
import { formatDuration, formatWithUnit } from '../lib/format';
import { goldenValue } from './goldenBatch';
import { blockReason, manualBlockReason, type Block } from './interlocks';
import type {
  Alarm,
  AlarmKind,
  AlarmPriority,
  Command,
  CommandResult,
  CommStatus,
  DataSource,
  EventAction,
  EventCategory,
  IsaPriority,
  OverallStatus,
  PhaseTracePoint,
  PlantEvent,
  PlcSnapshot,
  TrendPoint,
} from './types';

const MAX_EVENTS = 2000;
const TRACE_POINTS_PER_PHASE = 400;

export interface PlantState {
  /** Última leitura recebida do CLP (fonte única de verdade para todos os componentes). */
  snapshot: PlcSnapshot | null;
  lastReadAt: number | null;
  now: number;
  comm: CommStatus;
  history: Record<TagId, TrendPoint[]>;
  phaseTrace: PhaseTracePoint[];
  tracePhaseIndex: number;
  /** Lista de alarmes ativos / reconhecidos / normalizados não reconhecidos. */
  alarms: Alarm[];
  /** Histórico (mais recente primeiro). */
  events: PlantEvent[];
  /** Limites baixos armados na etapa atual (ver armLowAfterSetpoint). */
  lowArmed: Record<TagId, boolean>;
}

type Listener = () => void;
type AlarmListener = (alarm: Alarm) => void;

const COMMAND_LABEL: Record<Command['type'], (c: any) => string> = {
  start: () => 'START do processo',
  stop: () => 'STOP do processo',
  emergency: () => 'PARADA DE EMERGÊNCIA',
  resetEmergency: () => 'Rearme da emergência',
  valve: (c) => `${c.open ? 'Abrir' : 'Fechar'} ${VALVES.find((v) => v.id === c.id)?.short}`,
  motor: (c) => `${c.on ? 'Ligar' : 'Desligar'} ${EQUIPMENT.motor.name.toLowerCase()}`,
  pump: (c) => `${c.on ? 'Ligar' : 'Desligar'} ${EQUIPMENT.pump.name.toLowerCase()}`,
  manway: (c) => `${c.open ? 'Abrir' : 'Fechar'} ${EQUIPMENT.manway.name.toLowerCase()}`,
};

const BATCH_STATUS_TEXT: Record<PlcSnapshot['batch']['status'], string> = {
  idle: 'Processo aguardando início',
  running: 'Sequência automática em execução',
  stopped: 'Sequência parada · modo manual',
  emergency: 'Parada de emergência ativa',
  completed: 'Lote concluído',
};

/** Prioridade ISA-18.2 por tipo de alarme. */
const ISA_LEVEL: Record<AlarmKind, IsaPriority> = {
  HH: 'critica', LL: 'critica', COMM: 'critica', ESD: 'critica',
  H: 'alta', L: 'alta',
  FAULT: 'media',
};

/** Quem registrou o evento quando não é uma ação do operador. */
export const SYSTEM_USER: Record<EventCategory, string> = {
  process: 'Sistema (CLP)',
  alarm: 'Sistema (alarme)',
  operator: PLANT.operator,
};

const emptyByTag = <T,>(make: () => T) =>
  Object.fromEntries(TAG_ORDER.map((t) => [t, make()])) as Record<TagId, T>;

/**
 * Store único da planta. Recebe as leituras do DataSource, mantém histórico,
 * avalia alarmes (ISA-18.2) e encaminha comandos com intertravamento.
 * Componentes não têm lógica de processo: apenas leem daqui.
 */
export class PlantStore {
  private state: PlantState;
  private listeners = new Set<Listener>();
  private alarmListeners = new Set<AlarmListener>();
  private seq = 0;
  private startedAt = Date.now();
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(readonly source: DataSource) {
    this.state = {
      snapshot: null,
      lastReadAt: null,
      now: Date.now(),
      comm: 'connecting',
      history: emptyByTag<TrendPoint[]>(() => []),
      phaseTrace: [],
      tracePhaseIndex: -1,
      alarms: [],
      events: [],
      lowArmed: emptyByTag(() => false),
    };
  }

  start() {
    this.startedAt = Date.now();
    // Histórico anterior à conexão (do historiador/CLP; no simulador, desde o início do lote)
    const past = this.source.loadHistory?.() ?? [];
    if (past.length && this.state.events.length === 0) {
      const events = [...past].sort((a, b) => a.time - b.time).map((e) => ({ ...e, seq: ++this.seq }));
      this.state = { ...this.state, events: events.reverse().slice(0, MAX_EVENTS) };
    }
    this.source.start((s) => this.onSnapshot(s), {
      onConnection: (c) => this.onConnection(c),
      onEvent: (source, message) => {
        this.log('process', 'Comunicação', source, message);
        this.emit();
      },
    });
    this.watchdog = setInterval(() => this.checkComm(), 1000);
  }

  stop() {
    this.source.stop();
    if (this.watchdog) clearInterval(this.watchdog);
  }

  getState = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** Notificado apenas quando um alarme é ATIVADO (não a cada leitura). */
  onAlarmRaised(listener: AlarmListener) {
    this.alarmListeners.add(listener);
    return () => {
      this.alarmListeners.delete(listener);
    };
  }

  // ─── Comandos ────────────────────────────────────────────────────────────

  blockReason(cmd: Command): Block | null {
    // Fonte somente leitura (equipamento real): nenhum comando, nem a emergência
    if (this.source.readOnlyReason) return { message: this.source.readOnlyReason, kind: 'shared' };
    return blockReason(cmd, this.state.snapshot, this.state.comm === 'online');
  }

  manualBlockReason(): string | null {
    return this.source.readOnlyReason ?? manualBlockReason(this.state.snapshot, this.state.comm === 'online');
  }

  async send(cmd: Command): Promise<CommandResult> {
    const label = COMMAND_LABEL[cmd.type](cmd);
    const block = this.blockReason(cmd);
    if (block) {
      this.logOperator('Bloqueado', 'Operador', `${label} — bloqueado: ${block.message}`);
      this.emit();
      return { ok: false, reason: block.message };
    }
    // Registra o comando antes do envio, para que apareça antes das mudanças que ele causa
    this.logOperator('Comando', 'Operador', label);
    const result = await this.source.send(cmd);
    if (!result.ok) this.logOperator('Bloqueado', 'Operador', `${label} — recusado pelo CLP: ${result.reason}`);
    this.emit();
    return result;
  }

  acknowledge(id: string) {
    const now = Date.now();
    const alarms: Alarm[] = [];
    for (const a of this.state.alarms) {
      if (a.id !== id || a.state === 'acknowledged') {
        alarms.push(a);
        continue;
      }
      this.log('operator', 'Reconhecimento', a.source, `Reconheceu alarme: ${a.message}`, { user: PLANT.operator, alarmId: a.id, level: a.level });
      // Normalizado + reconhecido sai da lista de ativos
      if (a.state === 'active') alarms.push({ ...a, state: 'acknowledged', acknowledgedAt: now });
    }
    this.state = { ...this.state, alarms };
    this.emit();
  }

  acknowledgeAll() {
    for (const a of this.state.alarms) if (a.state !== 'acknowledged') this.acknowledge(a.id);
  }

  // ─── Leituras ────────────────────────────────────────────────────────────

  private onSnapshot(s: PlcSnapshot) {
    const now = Date.now();
    const prev = this.state;
    const phaseChanged = s.batch.phaseIndex !== prev.tracePhaseIndex || (prev.snapshot?.batch.lot ?? s.batch.lot) !== s.batch.lot;

    const history = { ...prev.history };
    const cutoff = now - HISTORY_WINDOW_S * 1000;
    for (const tag of TAG_ORDER) {
      const points = prev.history[tag].filter((p) => p.t >= cutoff);
      // NaN = sensor ainda sem dado (MQTT): não entra no histórico. Fontes com
      // updatedAt: só entra quando a tag foi atualizada (não repete o último valor).
      const updated = !s.updatedAt || (s.updatedAt[tag] !== undefined && s.updatedAt[tag] !== prev.snapshot?.updatedAt?.[tag]);
      if (Number.isFinite(s.tags[tag]) && updated) points.push({ t: now, v: s.tags[tag] });
      history[tag] = points;
    }

    const tMin = s.batch.phaseElapsedS / 60;
    let phaseTrace = phaseChanged ? [] : prev.phaseTrace;
    const minStep = PHASES[s.batch.phaseIndex].durationMin / TRACE_POINTS_PER_PHASE;
    const lastPoint = phaseTrace[phaseTrace.length - 1];
    if (!lastPoint || tMin - lastPoint.tMin >= minStep) {
      phaseTrace = [...phaseTrace, { tMin, ...s.tags }];
    }

    const lowArmed = phaseChanged ? emptyByTag(() => false) : { ...prev.lowArmed };
    // Arma os limites baixos quando a RECEITA atinge o setpoint (fim da rampa),
    // e não pelo valor medido — um distúrbio na rampa não deve armá-los.
    for (const tag of TAG_ORDER) {
      const lim = getLimits(tag, s.batch.phaseIndex);
      const ref = goldenValue(tag, s.batch.phaseIndex, tMin);
      if (!lowArmed[tag] && Math.abs(ref - lim.setpoint) <= lim.tolerance) lowArmed[tag] = true;
    }

    this.state = {
      ...prev,
      snapshot: s,
      lastReadAt: now,
      now,
      // Fonte que informa a conexão (MQTT) decide o estado; o biorreator real pode estar
      // 'silent' (sem etapas) e ainda receber analógicas
      comm: this.source.reportsConnection ? prev.comm : 'online',
      history,
      phaseTrace,
      tracePhaseIndex: s.batch.phaseIndex,
      lowArmed,
    };

    if (prev.comm === 'offline') this.log('process', 'Comunicação', 'CLP', 'Comunicação com o CLP restabelecida');
    if (prev.snapshot) this.logChanges(prev.snapshot, s);
    else this.log('process', 'Comunicação', 'CLP', `Conexão com o CLP estabelecida · lote ${s.batch.lot}, etapa ${PHASES[s.batch.phaseIndex].name}`);

    // Fonte que informa a conexão: o alarme segue onConnection (leitura analógica não prova que as etapas chegam)
    const commLost = !!this.source.reportsConnection && (this.state.comm === 'offline' || this.state.comm === 'silent');
    this.setAlarm('CLP:COMM', 'CLP', 'COMM', 'critical', 'Falha de comunicação com o CLP', commLost);
    this.evaluateProcessAlarms(s);
    this.emit();
  }

  /** Estado da conexão informado pela fonte (MQTT); a falha só vira alarme em "offline" ou "silent". */
  private onConnection(comm: CommStatus) {
    this.state = { ...this.state, now: Date.now(), comm };
    this.setAlarm('CLP:COMM', 'CLP', 'COMM', 'critical', 'Falha de comunicação com o CLP', comm === 'offline' || comm === 'silent');
    this.emit();
  }

  private checkComm() {
    const now = Date.now();
    if (this.source.reportsConnection) {
      // Ficar sem mensagens não é falha (valores publicados à mão): só atualiza o relógio
      this.state = { ...this.state, now };
      this.emit();
      return;
    }
    const ref = this.state.lastReadAt ?? this.startedAt;
    const lost = now - ref > COMM_TIMEOUT_MS;
    const comm: CommStatus = lost ? 'offline' : this.state.lastReadAt ? 'online' : 'connecting';
    if (lost && this.state.comm !== 'offline') {
      this.log('process', 'Comunicação', 'CLP', `Comunicação com o CLP perdida (sem leitura há mais de ${COMM_TIMEOUT_MS / 1000} s)`);
    }
    this.state = { ...this.state, now, comm };
    if (lost) this.setAlarm('CLP:COMM', 'CLP', 'COMM', 'critical', 'Falha de comunicação com o CLP', true);
    this.emit();
  }

  // ─── Alarmes ─────────────────────────────────────────────────────────────

  private evaluateProcessAlarms(s: PlcSnapshot) {
    const phase = s.batch.phaseIndex;
    for (const tag of TAG_ORDER) {
      const cfg = TAGS[tag];
      const lim = getLimits(tag, phase);
      const v = s.tags[tag];
      const db = cfg.deadband;
      const lowArmed = !lim.armLowAfterSetpoint || this.state.lowArmed[tag];
      const fmt = (x: number) => formatWithUnit(x, cfg.decimals, cfg.unit);
      const isActive = (kind: AlarmKind) =>
        this.state.alarms.some((a) => a.id === `${tag}:${kind}` && a.state !== 'normalized');

      const check = (kind: AlarmKind, limit: number | undefined, high: boolean, priority: AlarmPriority, label: string) => {
        let on = false;
        if (limit !== undefined && (high || lowArmed)) {
          const threshold = isActive(kind) ? (high ? limit - db : limit + db) : limit;
          on = high ? v >= threshold : v <= threshold;
        }
        this.setAlarm(`${tag}:${kind}`, tag, kind, priority,
          `${cfg.name} ${label} (limite ${fmt(limit ?? 0)})`, on);
      };

      check('HH', lim.critHi, true, 'critical', 'muito alta');
      check('H', lim.warnHi, true, 'warning', 'alta');
      check('L', lim.warnLo, false, 'warning', 'baixa');
      check('LL', lim.critLo, false, 'critical', 'muito baixa');
    }

    for (const v of VALVES) {
      this.setAlarm(`${v.id}:FAULT`, v.id, 'FAULT', 'warning',
        `${v.short} (${v.function.toLowerCase()}) em falha — sem confirmação de posição`, s.valves[v.id] === 'fault');
    }

    this.setAlarm('ESD:ESD', 'ESD', 'ESD', 'critical', 'Parada de emergência acionada', s.batch.status === 'emergency');
  }

  private setAlarm(id: string, source: string, kind: AlarmKind, priority: AlarmPriority, message: string, on: boolean) {
    const now = Date.now();
    const existing = this.state.alarms.find((a) => a.id === id);

    if (on) {
      if (existing && existing.state !== 'normalized') return;
      const alarm: Alarm = { id, source, kind, priority, level: ISA_LEVEL[kind], message, state: 'active', activatedAt: now };
      const others = this.state.alarms.filter((a) => a.id !== id);
      this.state = { ...this.state, alarms: [alarm, ...others] };
      this.log('alarm', 'Ativado', source, message, { priority, level: alarm.level, alarmId: id });
      for (const l of this.alarmListeners) l(alarm);
      return;
    }

    if (!existing || existing.state === 'normalized') return;
    this.log('alarm', 'Normalizado', source, existing.message, { priority: existing.priority, level: existing.level, alarmId: id });
    const alarms = existing.state === 'acknowledged'
      ? this.state.alarms.filter((a) => a.id !== id)
      : this.state.alarms.map((a) => (a.id === id ? { ...a, state: 'normalized' as const, normalizedAt: now } : a));
    this.state = { ...this.state, alarms };
  }

  // ─── Histórico de eventos ──────────────────────────────────────────────────

  /** Registra mudanças de etapa, estado do processo, válvulas e equipamentos. */
  private logChanges(prev: PlcSnapshot, s: PlcSnapshot) {
    if (s.batch.lot !== prev.batch.lot) {
      this.log('process', 'Estado do processo', 'Sequência', `Novo lote ${s.batch.lot} iniciado`);
    }
    if (s.batch.phaseIndex !== prev.batch.phaseIndex) {
      const p = PHASES[s.batch.phaseIndex];
      this.log('process', 'Mudança de etapa', 'Sequência', `Etapa ${s.batch.phaseIndex + 1}/${PHASES.length} · ${p.name} iniciada`);
    }
    if (s.batch.status !== prev.batch.status) {
      this.log('process', 'Estado do processo', 'Sequência', BATCH_STATUS_TEXT[s.batch.status]);
    }
    for (const v of VALVES) {
      const before = prev.valves[v.id];
      const after = s.valves[v.id];
      if (after === before || after === 'transition') continue;
      const text = after === 'open' ? 'aberta' : after === 'closed' ? 'fechada' : 'em falha';
      this.log('process', 'Válvula', v.id, `${VALVE_BY_ID[v.id].short} (${v.function.toLowerCase()}) ${text}`);
    }
    if (s.motorOn !== prev.motorOn) {
      this.log('process', 'Equipamento', EQUIPMENT.motor.id, `${EQUIPMENT.motor.name} ${s.motorOn ? 'ligado' : 'desligado'}`);
    }
    if (s.pumpOn !== prev.pumpOn) {
      this.log('process', 'Equipamento', EQUIPMENT.pump.id, `${EQUIPMENT.pump.name} ${s.pumpOn ? 'ligada' : 'desligada'}`);
    }
    if (s.manwayOpen !== prev.manwayOpen) {
      this.log('process', 'Equipamento', EQUIPMENT.manway.id, `${EQUIPMENT.manway.name} ${s.manwayOpen ? 'aberta' : 'fechada'}`);
    }
  }

  private logOperator(action: EventAction, source: string, message: string) {
    this.log('operator', action, source, message, { user: PLANT.operator });
  }

  private log(
    category: EventCategory,
    action: EventAction,
    source: string,
    message: string,
    extra: Partial<Pick<PlantEvent, 'priority' | 'level' | 'user' | 'alarmId'>> = {},
  ) {
    const event: PlantEvent = { seq: ++this.seq, time: Date.now(), category, action, source, message, user: SYSTEM_USER[category], ...extra };
    this.state = { ...this.state, events: [event, ...this.state.events].slice(0, MAX_EVENTS) };
  }

  private emit() {
    for (const l of this.listeners) l();
  }
}

// ─── Derivações (sem estado próprio) ──────────────────────────────────────

/** Status geral derivado dos alarmes ativos e da comunicação. */
export function overallStatus(state: PlantState): OverallStatus {
  if (state.comm === 'offline' || state.comm === 'silent') return 'critical';
  const active = state.alarms.filter((a) => a.state !== 'normalized');
  if (active.some((a) => a.priority === 'critical')) return 'critical';
  if (active.some((a) => a.priority === 'warning')) return 'warning';
  return 'normal';
}

export interface Freshness {
  /** Hora da última atualização; null = ainda sem dado. */
  updatedAt: number | null;
  /** Sem dado, ou sem atualização há mais de staleAfterS do snapshot (padrão MQTT.staleAfterMin). */
  stale: boolean;
  /** Texto do tooltip: "atualizado há 3 min", "Dado antigo · atualizado há 12 min"… */
  title: string;
  /** A última leitura chegou mas foi descartada (ex.: "Fora da escala: 3,00 kgf/cm²…"). */
  rejected?: string;
}

/**
 * Idade de um valor (sensor, válvula, motor…), para fontes que informam a hora de
 * cada tag (MQTT). undefined = a fonte não informa (simulador): nada muda na tela.
 */
export function freshness(state: PlantState, key: string): Freshness | undefined {
  const updated = state.snapshot?.updatedAt;
  if (!updated) return undefined;
  const at = updated[key];
  const rejected = state.snapshot?.rejected?.[key];
  if (at === undefined) return { updatedAt: null, stale: true, title: rejected ?? 'Aguardando dados do equipamento', rejected };
  const ageS = Math.max(0, (state.now - at) / 1000);
  const stale = ageS > (state.snapshot?.staleAfterS ?? MQTT.staleAfterMin * 60);
  const age = `${stale ? 'Dado antigo · ' : ''}atualizado há ${formatDuration(ageS)}`;
  return { updatedAt: at, stale, title: rejected ? `${rejected} · ${age}` : age, rejected };
}

export type TagStatus = 'normal' | 'warning' | 'critical' | 'bad';

export function tagStatus(state: PlantState, tag: TagId): TagStatus {
  const fresh = freshness(state, tag);
  // 'silent' = sem mensagens de etapas (biorreator real): as analógicas seguem pelo próprio watchdog (freshness)
  const linkOk = state.comm === 'online' || (state.comm === 'silent' && fresh !== undefined);
  if (!linkOk || fresh?.stale || fresh?.rejected) return 'bad';
  const active = state.alarms.filter((a) => a.source === tag && a.state !== 'normalized');
  if (active.some((a) => a.priority === 'critical')) return 'critical';
  if (active.length) return 'warning';
  return 'normal';
}
