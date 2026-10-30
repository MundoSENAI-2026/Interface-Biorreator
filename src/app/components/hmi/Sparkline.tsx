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

/**
 * Mini-tendência dos últimos minutos. O eixo Y sempre inclui os limites da
 * etapa e o setpoint, com folga — nenhuma linha de limite fica colada na borda.
 */
export function Sparkline({ points, limits, minSpan, windowS, muted, height = 40 }: SparklineProps) {
  const end = points.length ? points[points.length - 1].t : Date.now();
  const start = end - windowS * 1000;
  const visible = points.filter((p) => p.t >= start);

  const marks = [limits.critLo, limits.warnLo, limits.setpoint, limits.warnHi, limits.critHi].filter(
    (x): x is number => x !== undefined,
  );
  const all = [...marks, ...visible.map((p) => p.v)];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;

  const x = (t: number) => ((t - start) / (end - start)) * W;
  const y = (v: number) => height - ((v - lo) / (hi - lo)) * height;
  const path = visible.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');

  const refs = [
    { v: limits.warnHi, cls: 'stroke-st-warning' },
    { v: limits.warnLo, cls: 'stroke-st-warning' },
    { v: limits.critHi, cls: 'stroke-st-critical' },
    { v: limits.critLo, cls: 'stroke-st-critical' },
  ].filter((r): r is { v: number; cls: string } => r.v !== undefined);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <rect width={W} height={height} className="fill-sunken" />
      {refs.map((r, i) => (
        <line key={i} x1={0} x2={W} y1={y(r.v)} y2={y(r.v)} className={r.cls} strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
      ))}
      <line x1={0} x2={W} y1={y(limits.setpoint)} y2={y(limits.setpoint)} className="stroke-st-info/50" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {visible.length > 1 && (
        <path
          d={path}
          fill="none"
          className={muted ? 'stroke-st-offline' : 'stroke-ink-default'}
          strokeWidth={1.75}
          strokeDasharray={muted ? '3 3' : undefined}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
