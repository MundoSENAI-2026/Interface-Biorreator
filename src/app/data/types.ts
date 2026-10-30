import type { TagId, ValveId } from '../config/plant';

export type ValveState = 'open' | 'closed' | 'transition' | 'fault';

/** Estado do lote: 'running' = sequência automática; 'stopped' = parado/manual. */
export type BatchStatus = 'idle' | 'running' | 'stopped' | 'emergency' | 'completed';

export interface BatchInfo {
  lot: string;
  status: BatchStatus;
  phaseIndex: number;
  /** Tempo de processo decorrido na etapa atual (s). */
  phaseElapsedS: number;
  /** Tempo de processo gasto em cada etapa (s); null = ainda não executada. */
  phaseDurationsS: (number | null)[];
  /** Início do lote (relógio real, ms). */
  startedAt: number;
}

/** Leitura completa do CLP em um ciclo de varredura. */
export interface PlcSnapshot {
  timestamp: number;
  tags: Record<TagId, number>;
  valves: Record<ValveId, ValveState>;
  motorOn: boolean;
  /** Rotação do agitador (rpm). */
  motorRpm: number;
  pumpOn: boolean;
  manwayOpen: boolean;
  batch: BatchInfo;
}

export type Command =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'emergency' }
  | { type: 'resetEmergency' }
  | { type: 'valve'; id: ValveId; open: boolean }
  | { type: 'motor'; on: boolean }
  | { type: 'pump'; on: boolean }
  | { type: 'manway'; open: boolean };

export interface CommandResult {
  ok: boolean;
  reason?: string;
}

/**
 * Fonte de dados do CLP. Hoje: simulador. Depois: OPC UA, MQTT ou API REST —
 * basta implementar esta interface e trocá-la em data/source.ts.
 */
export interface DataSource {
  readonly kind: 'simulador' | 'opcua' | 'mqtt' | 'api';
  start(onSnapshot: (snapshot: PlcSnapshot) => void): void;
  stop(): void;
  send(command: Command): Promise<CommandResult>;
}

export type AlarmPriority = 'critical' | 'warning';
/** ISA-18.2: ativo não reconhecido, ativo reconhecido, normalizado não reconhecido. */
export type AlarmState = 'active' | 'acknowledged' | 'normalized';
export type AlarmKind = 'HH' | 'H' | 'L' | 'LL' | 'FAULT' | 'COMM' | 'ESD';

export interface Alarm {
  id: string;
  source: string;
  kind: AlarmKind;
  priority: AlarmPriority;
  message: string;
  state: AlarmState;
  activatedAt: number;
  acknowledgedAt?: number;
  normalizedAt?: number;
}

/** Alarme / Evento de processo / Ação do operador. */
export type EventCategory = 'alarm' | 'process' | 'operator';

export type EventAction =
  | 'Ativado'
  | 'Normalizado'
  | 'Reconhecimento'
  | 'Comando'
  | 'Bloqueado'
  | 'Mudança de etapa'
  | 'Estado do processo'
  | 'Válvula'
  | 'Equipamento'
  | 'Comunicação';

/** Registro do histórico (trilha de auditoria): alarmes, processo e operador. */
export interface PlantEvent {
  seq: number;
  time: number;
  category: EventCategory;
  action: EventAction;
  /** Só para alarmes. */
  priority?: AlarmPriority;
  source: string;
  message: string;
  /** Quem executou (ações do operador). */
  user?: string;
}

export interface TrendPoint {
  t: number;
  v: number;
}

/** Ponto da curva da etapa atual (minutos de processo + valores das tags). */
export type PhaseTracePoint = { tMin: number } & Record<TagId, number>;

export type CommStatus = 'connecting' | 'online' | 'offline';

export type OverallStatus = 'normal' | 'warning' | 'critical';
