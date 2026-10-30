import type { TagLimits } from '../../config/plant';
import type { TrendPoint } from '../../data/types';

interface SparklineProps {
  points: TrendPoint[];
  limits: TagLimits;
  minSpan: number;
  windowS: number;
  muted?: boolean;
  height?: number;
}

const W = 240;

/** Mini-tendência dos últimos minutos, com linhas de limite que caem na escala. */
export function Sparkline({ points, limits, minSpan, windowS, muted, height = 40 }: SparklineProps) {
  if (points.length < 2) {
    return <div style={{ height }} className="rounded-sm bg-sunken" />;
  }
  const end = points[points.length - 1].t;
  const start = end - windowS * 1000;
  const values = points.map((p) => p.v);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.15;
  lo -= pad;
  hi += pad;

  const x = (t: number) => ((t - start) / (end - start)) * W;
  const y = (v: number) => height - 2 - ((v - lo) / (hi - lo)) * (height - 4);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');

  const refs = [
    { v: limits.warnHi, cls: 'stroke-st-warning' },
    { v: limits.warnLo, cls: 'stroke-st-warning' },
    { v: limits.critHi, cls: 'stroke-st-critical' },
    { v: limits.critLo, cls: 'stroke-st-critical' },
  ].filter((r): r is { v: number; cls: string } => r.v !== undefined && r.v > lo && r.v < hi);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <rect width={W} height={height} className="fill-sunken" />
      {refs.map((r, i) => (
        <line key={i} x1={0} x2={W} y1={y(r.v)} y2={y(r.v)} className={r.cls} strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      ))}
      <path
        d={path}
        fill="none"
        className={muted ? 'stroke-st-offline' : 'stroke-ink-default'}
        strokeWidth={1.5}
        strokeDasharray={muted ? '3 3' : undefined}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
