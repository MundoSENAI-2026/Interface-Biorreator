import type { IsaPriority, PlantEvent } from './types';

export const LEVEL_LABEL: Record<IsaPriority, string> = { critica: 'Crítica', alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const LEVELS: IsaPriority[] = ['critica', 'alta', 'media', 'baixa'];

/** Meta ISA-18.2 de carga de alarmes por operador: até 1 alarme a cada 10 min. */
export const ALARM_RATE_TARGET_PER_10MIN = 1;

export interface AlarmStats {
  totalLot: number;
  total24h: number;
  byLevel: Record<IsaPriority, number>;
  /** Alarmes por janela de 10 min (mais antiga → mais recente). */
  rate: { start: number; count: number }[];
  meanAckS: number | null;
  top: { source: string; message: string; count: number }[];
  lastNormalizedAt: number | null;
}

/** Indicadores de alarmes a partir do histórico de eventos (mais recente primeiro). */
export function alarmStats(events: PlantEvent[], lotStart: number, now: number, rateBuckets = 6): AlarmStats {
  const chronological = [...events].reverse();
  const activations = chronological.filter((e) => e.category === 'alarm' && e.action === 'Ativado');
  const inLot = activations.filter((e) => e.time >= lotStart);

  const byLevel: Record<IsaPriority, number> = { critica: 0, alta: 0, media: 0, baixa: 0 };
  for (const e of inLot) byLevel[e.level ?? (e.priority === 'critical' ? 'critica' : 'alta')] += 1;

  const bucketMs = 10 * 60 * 1000;
  const firstStart = now - rateBuckets * bucketMs;
  const rate = Array.from({ length: rateBuckets }, (_, i) => ({ start: firstStart + i * bucketMs, count: 0 }));
  for (const e of activations) {
    const i = Math.floor((e.time - firstStart) / bucketMs);
    if (i >= 0 && i < rateBuckets) rate[i].count += 1;
  }

  // Tempo até o reconhecimento: cada reconhecimento × a ativação anterior do mesmo alarme
  const lastActivation = new Map<string, number>();
  const ackDelays: number[] = [];
  for (const e of chronological) {
    if (!e.alarmId) continue;
    if (e.category === 'alarm' && e.action === 'Ativado') lastActivation.set(e.alarmId, e.time);
    if (e.action === 'Reconhecimento') {
      const t = lastActivation.get(e.alarmId);
      if (t !== undefined && e.time >= t) {
        ackDelays.push((e.time - t) / 1000);
        lastActivation.delete(e.alarmId);
      }
    }
  }

  const counts = new Map<string, { source: string; message: string; count: number }>();
  for (const e of inLot) {
    const key = e.alarmId ?? `${e.source}:${e.message}`;
    const c = counts.get(key) ?? { source: e.source, message: e.message, count: 0 };
    c.count += 1;
    counts.set(key, c);
  }

  const lastNormalized = events.find((e) => e.category === 'alarm' && e.action === 'Normalizado');

  return {
    totalLot: inLot.length,
    total24h: activations.filter((e) => e.time >= now - 24 * 3600 * 1000).length,
    byLevel,
    rate,
    meanAckS: ackDelays.length ? ackDelays.reduce((a, d) => a + d, 0) / ackDelays.length : null,
    top: [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    lastNormalizedAt: lastNormalized?.time ?? null,
  };
}
