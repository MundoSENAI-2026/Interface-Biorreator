import {
  EQUIPMENT,
  INTERLOCKS,
  PHASES,
  PLANT,
  SIMULATION,
  TAGS,
  TAG_ORDER,
  VALVES,
  VALVE_STROKE_MS,
  getLimits,
  type TagId,
  type ValveId,
} from '../config/plant';
import { goldenValue } from './goldenBatch';
import { seedHistory } from './historySeed';
import { blockReason } from './interlocks';
import type { BatchInfo, Command, CommandResult, DataSource, HistoryRecord, PlcSnapshot, ValveState } from './types';

export type ForceLevel = 'normal' | 'warning' | 'critical';

/** Controles extras do simulador para testes e demonstração. */
export interface SimulationControls {
  readonly acceleration: number;
  setAcceleration(factor: number): void;
  readonly forced: Partial<Record<TagId, ForceLevel>>;
  force(tag: TagId, level: ForceLevel): void;
  readonly commLost: boolean;
  setCommLost(lost: boolean): void;
  readonly faults: ReadonlySet<ValveId>;
  setValveFault(id: ValveId, fault: boolean): void;
  skipPhase(): void;
  /** Recomeça o lote em execução na etapa/minuto indicados, sem distúrbios nem falhas. */
  resetToPhase(phaseIndex: number, minute: number): void;
}

const NOISE: Record<TagId, number> = {
  TIT_100_01: 0.12,
  LIT_100_01: 0.08,
  PIT_100_01: 0.004,
  AIT_100_01: 0.008,
};

/** Constante de tempo (s de processo) com que a variável segue o perfil. */
const PROCESS_LAG_S = 30;
/** Constante de tempo (s reais) com que um distúrbio forçado se instala. */
const DISTURBANCE_LAG_S = 4;

const INLETS: ValveId[] = ['XV_100_01', 'XV_100_03', 'XV_100_09'];
const OUTLETS: ValveId[] = ['XV_100_02', 'XV_100_04'];

const noise = (amplitude: number) => (Math.random() - 0.5) * 2 * amplitude;

/** Tempo de processo (s) até `minute` da etapa `phase`, com as etapas anteriores na duração nominal. */
function elapsedBefore(phase: number, minute: number): number {
  return PHASES.slice(0, phase).reduce((acc, p) => acc + p.durationMin * 60, 0) + minute * 60;
}

export function lotCode(date: Date): string {
  const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${PLANT.batchPrefix}-${ymd}-01`;
}

/**
 * Simulador do CLP: executa a sequência de etapas com valores plausíveis
 * (perfil do lote de ouro + dinâmica + ruído) e aplica intertravamentos.
 */
export class Simulator implements DataSource, SimulationControls {
  readonly kind = 'simulador' as const;

  acceleration = SIMULATION.acceleration;
  forced: Partial<Record<TagId, ForceLevel>> = {};
  commLost = false;
  faults = new Set<ValveId>();

  private base = {} as Record<TagId, number>;
  private disturbance = {} as Record<TagId, number>;
  private valves = {} as Record<ValveId, ValveState>;
  private valveMoves = new Map<ValveId, { open: boolean; until: number }>();
  private motorOn = false;
  private motorRpm = 0;
  private pumpOn = false;
  private manwayOpen = false;
  private batch: BatchInfo;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listener: ((s: PlcSnapshot) => void) | null = null;
  private last: PlcSnapshot | null = null;

  constructor() {
    const phase = SIMULATION.startPhase;
    const tMin = SIMULATION.startMinute;
    this.batch = {
      lot: lotCode(new Date()),
      status: 'running',
      phaseIndex: phase,
      phaseElapsedS: tMin * 60,
      phaseDurationsS: PHASES.map((p, i) => (i < phase ? p.durationMin * 60 : null)),
      startedAt: Date.now() - elapsedBefore(phase, tMin) * 1000,
    };
    for (const tag of TAG_ORDER) {
      this.base[tag] = goldenValue(tag, phase, tMin);
      this.disturbance[tag] = 0;
    }
    for (const v of VALVES) this.valves[v.id] = 'closed';
    this.applyPhaseEquipment(true);
  }

  // ─── DataSource ──────────────────────────────────────────────────────────

  start(onSnapshot: (s: PlcSnapshot) => void) {
    this.listener = onSnapshot;
    this.timer = setInterval(() => this.tick(), SIMULATION.scanMs);
    this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listener = null;
  }

  loadHistory(): HistoryRecord[] {
    const b = this.batch;
    return seedHistory(b.startedAt, b.phaseIndex, b.phaseElapsedS, b.lot);
  }

  async send(cmd: Command): Promise<CommandResult> {
    if (this.commLost) {
      await new Promise((r) => setTimeout(r, 800));
      return { ok: false, reason: 'Sem resposta do CLP' };
    }
    const block = blockReason(cmd, this.last ?? this.snapshot(), true);
    if (block) return { ok: false, reason: block.message };

    switch (cmd.type) {
      case 'start':
        if (this.batch.status === 'completed' || this.batch.status === 'idle') this.newBatch();
        this.batch.status = 'running';
        this.applyPhaseEquipment(false);
        break;
      case 'stop':
        this.batch.status = 'stopped';
        break;
      case 'emergency':
        this.batch.status = 'emergency';
        this.motorOn = false;
        this.pumpOn = false;
        // Estado seguro: tudo fechado, exaustão aberta para aliviar pressão
        for (const v of VALVES) this.moveValve(v.id, v.id === 'XV_100_08', true);
        break;
      case 'resetEmergency':
        this.batch.status = 'stopped';
        break;
      case 'valve':
        this.moveValve(cmd.id, cmd.open, false);
        break;
      case 'motor':
        this.motorOn = cmd.on;
        break;
      case 'pump':
        this.pumpOn = cmd.on;
        break;
      case 'manway':
        this.manwayOpen = cmd.open;
        break;
    }
    this.publish();
    return { ok: true };
  }

  // ─── SimulationControls ──────────────────────────────────────────────────

  setAcceleration(factor: number) {
    this.acceleration = factor;
  }

  force(tag: TagId, level: ForceLevel) {
    if (level === 'normal') delete this.forced[tag];
    else this.forced[tag] = level;
  }

  setCommLost(lost: boolean) {
    this.commLost = lost;
  }

  setValveFault(id: ValveId, fault: boolean) {
    if (fault) {
      this.faults.add(id);
      if (id === INTERLOCKS.pumpRequiresValve) this.pumpOn = false;
    } else {
      this.faults.delete(id);
      this.valves[id] = 'closed';
    }
  }

  resetToPhase(phaseIndex: number, minute: number) {
    this.forced = {};
    this.faults.clear();
    this.commLost = false;
    this.manwayOpen = false;
    this.batch = {
      lot: this.batch.lot,
      status: 'running',
      phaseIndex,
      phaseElapsedS: minute * 60,
      phaseDurationsS: PHASES.map((p, i) => (i < phaseIndex ? p.durationMin * 60 : null)),
      startedAt: Date.now() - elapsedBefore(phaseIndex, minute) * 1000,
    };
    for (const tag of TAG_ORDER) {
      this.base[tag] = goldenValue(tag, phaseIndex, minute);
      this.disturbance[tag] = 0;
    }
    this.applyPhaseEquipment(true);
    this.publish();
  }

  skipPhase() {
    if (this.batch.status !== 'running') return;
    this.batch.phaseElapsedS = PHASES[this.batch.phaseIndex].durationMin * 60;
    this.tick();
  }

  // ─── Ciclo de varredura ──────────────────────────────────────────────────

  private tick() {
    const dtReal = SIMULATION.scanMs / 1000;
    const dtProc = dtReal * this.acceleration;

    if (this.batch.status === 'running') {
      this.batch.phaseElapsedS += dtProc;
      const phase = PHASES[this.batch.phaseIndex];
      if (this.batch.phaseElapsedS >= phase.durationMin * 60) this.advancePhase();
    }

    this.updateValves();
    this.updateProcess(dtReal, dtProc);
    this.publish();
  }

  private publish() {
    this.last = this.snapshot();
    if (!this.commLost) this.listener?.(this.last);
  }

  private advancePhase() {
    const b = this.batch;
    b.phaseDurationsS[b.phaseIndex] = Math.min(b.phaseElapsedS, PHASES[b.phaseIndex].durationMin * 60);
    if (b.phaseIndex >= PHASES.length - 1) {
      b.status = 'completed';
      b.phaseElapsedS = PHASES[b.phaseIndex].durationMin * 60;
      this.motorOn = false;
      this.pumpOn = false;
      for (const v of VALVES) this.moveValve(v.id, false, false);
      return;
    }
    b.phaseIndex += 1;
    b.phaseElapsedS = 0;
    this.applyPhaseEquipment(false);
  }

  private newBatch() {
    this.batch = {
      lot: lotCode(new Date()),
      status: 'running',
      phaseIndex: 0,
      phaseElapsedS: 0,
      phaseDurationsS: PHASES.map(() => null),
      startedAt: Date.now(),
    };
  }

  /** Comanda válvulas, motor e bomba conforme a etapa atual (sequência automática). */
  private applyPhaseEquipment(immediate: boolean) {
    const phase = PHASES[this.batch.phaseIndex];
    for (const v of VALVES) this.moveValve(v.id, phase.valvesOpen.includes(v.id), immediate);
    this.motorOn = phase.motor;
    this.pumpOn = phase.pump;
  }

  private moveValve(id: ValveId, open: boolean, immediate: boolean) {
    if (this.faults.has(id)) return;
    const target: ValveState = open ? 'open' : 'closed';
    if (this.valves[id] === target && !this.valveMoves.has(id)) return;
    if (immediate) {
      this.valveMoves.delete(id);
      this.valves[id] = target;
      return;
    }
    this.valves[id] = 'transition';
    this.valveMoves.set(id, { open, until: Date.now() + VALVE_STROKE_MS });
  }

  private updateValves() {
    const now = Date.now();
    for (const [id, move] of this.valveMoves) {
      if (now >= move.until) {
        this.valves[id] = move.open ? 'open' : 'closed';
        this.valveMoves.delete(id);
      }
    }
    for (const id of this.faults) {
      this.valves[id] = 'fault';
      this.valveMoves.delete(id);
    }
  }

  private updateProcess(dtReal: number, dtProc: number) {
    const { status, phaseIndex, phaseElapsedS } = this.batch;

    if (status === 'running') {
      const alpha = 1 - Math.exp(-dtProc / PROCESS_LAG_S);
      for (const tag of TAG_ORDER) {
        const target = goldenValue(tag, phaseIndex, phaseElapsedS / 60);
        this.base[tag] += (target - this.base[tag]) * alpha;
      }
    } else {
      // Sem sequência: física simplificada dirigida pelos comandos manuais (tempo real)
      const open = (id: ValveId) => this.valves[id] === 'open';
      let dLevel = 0;
      for (const id of INLETS) if (open(id)) dLevel += 0.4;
      for (const id of OUTLETS) if (open(id)) dLevel -= 0.4;
      if (open('XV_100_10') && this.pumpOn) dLevel -= 0.8;
      this.base.LIT_100_01 = Math.min(100, Math.max(0, this.base.LIT_100_01 + dLevel * dtReal));

      // Ar de aeração (XV-05) pressuriza; exaustão (XV-08) alivia. Ambas abertas:
      // equilíbrio em ~0,13 kgf/cm² (contrapressão da aeração).
      const p = this.base.PIT_100_01;
      const dp = (open('XV_100_05') ? 0.045 : 0) - (open('XV_100_08') ? p / 3 : 0);
      this.base.PIT_100_01 = Math.min(TAGS.PIT_100_01.rangeMax, Math.max(0, p + dp * dtReal));

      // Camisa: vapor (XV-06) aquece até ~125 °C; água (XV-07) resfria até ~20 °C
      const jacketTarget = open('XV_100_06') ? 125 : open('XV_100_07') ? 20 : SIMULATION.ambientTemperature;
      const jacketTau = open('XV_100_06') || open('XV_100_07') ? 60 : 1800;
      this.base.TIT_100_01 += (jacketTarget - this.base.TIT_100_01) * (1 - Math.exp(-dtReal / jacketTau));
    }

    // Rotação do agitador com rampa de partida/parada
    const rpmTarget = this.motorOn ? EQUIPMENT.motor.ratedRpm : 0;
    this.motorRpm += (rpmTarget - this.motorRpm) * (1 - Math.exp(-dtReal / 2));

    // Distúrbios forçados pelo painel de simulação
    const beta = 1 - Math.exp(-dtReal / DISTURBANCE_LAG_S);
    for (const tag of TAG_ORDER) {
      const level = this.forced[tag];
      const desired = level && level !== 'normal' ? this.forcedTarget(tag, level) - this.base[tag] : 0;
      this.disturbance[tag] += (desired - this.disturbance[tag]) * beta;
    }
  }

  /** Valor absoluto a atingir quando a tag é forçada para alerta ou crítico (limites da etapa). */
  private forcedTarget(tag: TagId, level: Exclude<ForceLevel, 'normal'>): number {
    const lim = getLimits(tag, this.batch.phaseIndex);
    const { deadband, rangeMax } = TAGS[tag];
    const warn = lim.warnHi ?? lim.setpoint + deadband * 4;
    const crit = lim.critHi ?? warn + deadband * 4;
    const value = level === 'warning' ? (warn + crit) / 2 : crit + Math.max(deadband * 3, (crit - warn) * 0.4);
    return Math.min(rangeMax, value);
  }

  private snapshot(): PlcSnapshot {
    const tags = {} as Record<TagId, number>;
    for (const tag of TAG_ORDER) {
      const { rangeMin, rangeMax } = TAGS[tag];
      const v = this.base[tag] + this.disturbance[tag] + noise(NOISE[tag]);
      tags[tag] = Math.min(rangeMax, Math.max(rangeMin, v));
    }
    return {
      timestamp: Date.now(),
      tags,
      valves: { ...this.valves },
      motorOn: this.motorOn,
      motorRpm: this.motorRpm < 0.5 ? 0 : Math.max(0, this.motorRpm + noise(this.motorOn ? 0.8 : 0)),
      pumpOn: this.pumpOn,
      manwayOpen: this.manwayOpen,
      batch: { ...this.batch, phaseDurationsS: [...this.batch.phaseDurationsS] },
    };
  }
}
