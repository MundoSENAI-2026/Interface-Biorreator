import { PHASES, TAG_ORDER, getLimits, type TagId } from '../config/plant';
import type { TrendRow } from '../components/hmi/TrendChart';
import { goldenCurve, goldenValue } from './goldenBatch';
import type { PlantState } from './store';
import type { PhaseTracePoint, PlcSnapshot } from './types';

/** Duração nominal do lote inteiro (s de processo). */
export const BATCH_NOMINAL_S = PHASES.reduce((acc, p) => acc + p.durationMin * 60, 0);

export interface BatchTiming {
  startedAt: number;
  elapsedS: number;
  progress: number;
  phaseRemainingS: number;
  /** Previsão de término (relógio real), no ritmo atual do processo. */
  predictedEnd: number;
}

/**
 * Tempos do lote. `processRate` = segundos de processo por segundo real
 * (aceleração da simulação; 1 com o CLP real).
 */
export function batchTiming(s: PlcSnapshot, now: number, processRate = 1): BatchTiming {
  const done = s.batch.phaseDurationsS.reduce<number>((acc, d) => acc + (d ?? 0), 0);
  const elapsedS = done + (s.batch.status === 'completed' ? 0 : s.batch.phaseElapsedS);
  const phaseNominal = PHASES[s.batch.phaseIndex].durationMin * 60;
  const phaseRemainingS = s.batch.status === 'completed' ? 0 : Math.max(0, phaseNominal - s.batch.phaseElapsedS);
  const laterS = PHASES.slice(s.batch.phaseIndex + 1).reduce((acc, p) => acc + p.durationMin * 60, 0);
  const remainingS = s.batch.status === 'completed' ? 0 : phaseRemainingS + laterS;
  return {
    startedAt: s.batch.startedAt,
    elapsedS,
    progress: Math.min(1, elapsedS / BATCH_NOMINAL_S),
    phaseRemainingS,
    predictedEnd: now + (remainingS * 1000) / Math.max(processRate, 1e-6),
  };
}

/** Fração dos pontos da etapa atual (todas as variáveis) dentro da tolerância do lote de ouro. */
export function phaseConformity(trace: PhaseTracePoint[], phaseIndex: number): number | null {
  if (!trace.length) return null;
  let inside = 0;
  let total = 0;
  for (const tag of TAG_ORDER) {
    const tol = getLimits(tag, phaseIndex).tolerance;
    for (const p of trace) {
      if (!Number.isFinite(p[tag])) continue; // sensor ainda sem dado (MQTT)
      total += 1;
      if (Math.abs(p[tag] - goldenValue(tag, phaseIndex, p.tMin)) <= tol) inside += 1;
    }
  }
  return total ? inside / total : null;
}

/** Linhas do gráfico "etapa atual × lote de ouro" (curva de referência + medições). */
export function phaseTrendRows(plant: PlantState, tag: TagId, phaseIndex: number): TrendRow[] {
  const tol = getLimits(tag, phaseIndex).tolerance;
  const band = (ref: number): [number, number] => [ref - tol, ref + tol];
  const golden: TrendRow[] = goldenCurve(tag, phaseIndex).map(({ tMin, v }) => ({ x: tMin, reference: v, band: band(v) }));
  const actual: TrendRow[] = plant.phaseTrace.map((p) => {
    const ref = goldenValue(tag, phaseIndex, p.tMin);
    return { x: p.tMin, reference: ref, band: band(ref), actual: Number.isFinite(p[tag]) ? p[tag] : undefined };
  });
  return [...golden, ...actual].sort((a, b) => a.x - b.x);
}
