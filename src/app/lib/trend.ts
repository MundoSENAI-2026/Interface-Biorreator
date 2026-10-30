import type { TrendPoint } from '../data/types';

/** Inclinação (unidades por minuto) por regressão linear sobre a janela recente. */
export function slopePerMinute(points: TrendPoint[], windowS = 30): number {
  if (points.length < 2) return 0;
  const end = points[points.length - 1].t;
  const recent = points.filter((p) => p.t >= end - windowS * 1000);
  if (recent.length < 2) return 0;
  const n = recent.length;
  const t0 = recent[0].t;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const p of recent) {
    const x = (p.t - t0) / 60_000;
    sx += x; sy += p.v; sxx += x * x; sxy += x * p.v;
  }
  const den = n * sxx - sx * sx;
  return den === 0 ? 0 : (n * sxy - sx * sy) / den;
}
