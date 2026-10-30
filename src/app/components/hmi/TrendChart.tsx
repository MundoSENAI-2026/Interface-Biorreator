import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import type { TagLimits } from '../../config/plant';
import { formatNumber } from '../../lib/format';
import { cn } from '../ui/utils';

export interface TrendRow {
  x: number;
  actual?: number;
  /** Referência (lote de ouro) e faixa de tolerância — opcionais. */
  reference?: number;
  band?: [number, number];
}

interface TrendChartProps {
  rows: TrendRow[];
  unit: string;
  decimals: number;
  xDomain: [number, number];
  xTicks?: number[];
  /** Rótulo curto do eixo X. */
  formatX: (x: number) => string;
  /** Rótulo do tooltip. */
  formatXLong: (x: number) => string;
  /** Linha vertical "agora". */
  marker?: number;
  limits: TagLimits;
  className?: string;
  /** Mini gráfico: eixos menores e menos marcações. */
  compact?: boolean;
}

const css = (name: string) => `var(${name})`;
const AXIS = { fontSize: 14, fill: css('--text-muted') };

/** Escala "redonda" (passos 1/2/5 × 10ⁿ) cobrindo dados, tolerância e limites. */
export function niceScale(values: number[], targetTicks = 5): { domain: [number, number]; ticks: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const raw = Math.max((hi - lo) / targetTicks, 1e-3);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const end = Math.max(Math.ceil(hi / step) * step, start + step);
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [start, end], ticks };
}

/**
 * Tendência da variável: lote atual, lote de ouro com faixa de tolerância
 * (quando houver), linhas de alerta/crítico e tooltip com real × referência.
 */
export function TrendChart({ rows, unit, decimals, xDomain, xTicks, formatX, formatXLong, marker, limits, className, compact }: TrendChartProps) {
  const axis = compact ? { ...AXIS, fontSize: 13 } : AXIS;
  const fmt = (v: number) => formatNumber(v, decimals);
  const values = rows.flatMap((r) => [r.actual, r.reference, r.band?.[0], r.band?.[1]].filter((v): v is number => v !== undefined));
  for (const l of [limits.warnLo, limits.warnHi, limits.critLo, limits.critHi]) if (l !== undefined) values.push(l);
  const scale = niceScale(values.length ? values : [0, 1], compact ? 3 : 5);
  const tickDecimals = scale.ticks.length > 1 && scale.ticks[1] - scale.ticks[0] < 1 ? decimals : 0;
  const hasReference = rows.some((r) => r.reference !== undefined);

  const refLines = [
    { y: limits.critHi, color: '--status-critical' },
    { y: limits.warnHi, color: '--status-warning' },
    { y: limits.warnLo, color: '--status-warning' },
    { y: limits.critLo, color: '--status-critical' },
  ].filter((l): l is { y: number; color: string } => l.y !== undefined);

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as TrendRow;
    const dev = row.actual !== undefined && row.reference !== undefined ? row.actual - row.reference : undefined;
    return (
      <div className="rounded border border-line bg-surface px-3 py-2 text-sm shadow-sm num">
        <div className="mb-1 font-medium text-ink">{formatXLong(row.x)}</div>
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
          <span className="text-ink-muted">Real</span>
          <span className="text-right font-medium text-ink">{row.actual === undefined ? '—' : `${fmt(row.actual)} ${unit}`}</span>
          {row.reference !== undefined && (
            <>
              <span className="text-ink-muted">Referência</span>
              <span className="text-right text-ink">{fmt(row.reference)} {unit}</span>
              <span className="text-ink-muted">Desvio</span>
              <span className="text-right text-ink">{dev === undefined ? '—' : `${dev >= 0 ? '+' : '−'}${fmt(Math.abs(dev))} ${unit}`}</span>
            </>
          )}
          {row.band && (
            <>
              <span className="text-ink-muted">Tolerância</span>
              <span className="text-right text-ink">{fmt(row.band[0])} a {fmt(row.band[1])} {unit}</span>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('h-full min-h-0 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={compact ? { top: 6, right: 8, bottom: 0, left: 0 } : { top: 20, right: 20, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={css('--line-subtle')} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={xDomain}
            ticks={xTicks}
            tick={axis}
            tickLine={false}
            axisLine={{ stroke: css('--line-strong') }}
            height={compact ? 22 : 30}
            tickFormatter={formatX}
            allowDataOverflow
          />
          <YAxis
            domain={scale.domain}
            ticks={scale.ticks}
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={compact ? 44 : 64}
            tickFormatter={(v) => formatNumber(v, tickDecimals)}
            label={compact ? undefined : { value: unit, position: 'insideTopLeft', offset: 0, dy: -14, style: { ...AXIS, fontWeight: 600 } }}
          />
          {hasReference && (
            <Area dataKey="band" stroke="none" fill={css('--line-subtle')} fillOpacity={0.8} isAnimationActive={false} activeDot={false} />
          )}
          {refLines.map((l, i) => (
            <ReferenceLine key={i} y={l.y} stroke={css(l.color)} strokeDasharray="6 4" strokeWidth={1.5} />
          ))}
          {marker !== undefined && <ReferenceLine x={marker} stroke={css('--line-strong')} strokeWidth={1} />}
          {hasReference && (
            <Line dataKey="reference" stroke={css('--text-muted')} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          )}
          <Line
            dataKey="actual"
            stroke={css('--brand-blue')}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, stroke: css('--surface-card'), strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: css('--line-strong'), strokeWidth: 1 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
