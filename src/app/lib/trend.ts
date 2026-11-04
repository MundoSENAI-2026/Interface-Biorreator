import type { TrendPoint } from '../data/types';

/** Média móvel simples (janela em número de amostras). */
function movingAverage(points: TrendPoint[], window: number): TrendPoint[] {
  if (window <= 1) return points;
  let sum = 0;
  return points.map((p, i) => {
    sum += p.v;
    if (i >= window) sum -= points[i - window].v;
    return { t: p.t, v: sum / Math.min(i + 1, window) };
  });
}

/**
 * Taxa de variação em unidades por minuto de TEMPO DE PROCESSO.
 * `processRate` = segundos de processo por segundo real (fator de aceleração da
 * simulação; 1 com o CLP real). A série é suavizada por média móvel antes da
 * regressão linear, para não reagir a ruído nem a degraus pontuais.
 */
export function slopePerMinute(points: TrendPoint[], processRate = 1, windowS = 60, smoothSamples = 10): number {
  if (points.length < 2) return 0;
  const end = points[points.length - 1].t;
  const recent = movingAverage(points.filter((p) => p.t >= end - windowS * 1000), smoothSamples);
  if (recent.length < 2) return 0;
  const n = recent.length;
  const t0 = recent[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of recent) {
    const x = (p.t - t0) / 60_000;
    sx += x; sy += p.v; sxx += x * x; sxy += x * p.v;
  }
  const den = n * sxx - sx * sx;
  const perRealMinute = den === 0 ? 0 : (n * sxy - sx * sy) / den;
  return perRealMinute / Math.max(processRate, 1e-6);
}
