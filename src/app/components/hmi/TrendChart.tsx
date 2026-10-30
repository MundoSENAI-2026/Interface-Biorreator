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

export interface TrendRow {
  tMin: number;
  reference: number;
  band: [number, number];
  actual?: number;
}

interface TrendChartProps {
  rows: TrendRow[];
  unit: string;
  decimals: number;
  durationMin: number;
  nowMin: number;
  limits: TagLimits;
  height?: number;
}

const css = (name: string) => `var(${name})`;
const AXIS = { fontSize: 11, fill: css('--text-muted') };

/** Escala "redonda" (passos 1/2/5 × 10ⁿ) cobrindo dados, tolerância e limites. */
function niceScale(rows: TrendRow[], limits: TagLimits): { domain: [number, number]; ticks: number[] } {
  const values = rows.flatMap((r) => [r.band[0], r.band[1], r.actual ?? r.reference]);
  for (const l of [limits.warnLo, limits.warnHi, limits.critLo, limits.critHi]) if (l !== undefined) values.push(l);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const raw = Math.max((hi - lo) / 5, 0.01);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(6)));
  return { domain: [start, end], ticks };
}

/**
 * Tendência real × lote de ouro: faixa de tolerância sombreada,
 * linhas de alerta/crítico e tooltip com real, referência e desvio.
 */
export function TrendChart({ rows, unit, decimals, durationMin, nowMin, limits, height = 260 }: TrendChartProps) {
  const fmt = (v: number) => formatNumber(v, decimals);
  const scale = niceScale(rows, limits);
  const refLines = [
    { y: limits.critHi, color: '--status-critical', label: 'Crítico' },
    { y: limits.warnHi, color: '--status-warning', label: 'Alerta' },
    { y: limits.warnLo, color: '--status-warning', label: 'Alerta' },
    { y: limits.critLo, color: '--status-critical', label: 'Crítico' },
  ].filter((l): l is { y: number; color: string; label: string } => l.y !== undefined);

  const renderTooltip = ({ active, payload }: TooltipProps<number, string>) => {
    if (!active || !payload?.length) return null;
    const row = payload[0].payload as TrendRow;
    const dev = row.actual === undefined ? undefined : row.actual - row.reference;
    return (
      <div className="rounded border border-line bg-surface px-3 py-2 text-xs shadow-sm num">
        <div className="mb-1 font-medium text-ink">t = {formatNumber(row.tMin, 1)} min de etapa</div>
        <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5">
          <span className="text-ink-muted">Real</span>
          <span className="text-right font-medium text-ink">{row.actual === undefined ? '—' : `${fmt(row.actual)} ${unit}`}</span>
          <span className="text-ink-muted">Referência</span>
          <span className="text-right text-ink">{fmt(row.reference)} {unit}</span>
          <span className="text-ink-muted">Desvio</span>
          <span className="text-right text-ink">
            {dev === undefined ? '—' : `${dev >= 0 ? '+' : '−'}${fmt(Math.abs(dev))} ${unit}`}
          </span>
          <span className="text-ink-muted">Tolerância</span>
          <span className="text-right text-ink">{fmt(row.band[0])} a {fmt(row.band[1])} {unit}</span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 16, right: 16, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={css('--line-subtle')} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="tMin"
            type="number"
            domain={[0, durationMin]}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: css('--line-strong') }}
            tickFormatter={(v) => `${formatNumber(v, 0)} min`}
          />
          <YAxis
            domain={scale.domain}
            ticks={scale.ticks}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={56}
            tickFormatter={(v) => formatNumber(v, scale.ticks[1] - scale.ticks[0] < 1 ? decimals : 0)}
            label={{ value: unit, position: 'insideTopLeft', offset: 0, dy: -4, style: { ...AXIS, fontWeight: 500 } }}
          />
          <Area
            dataKey="band"
            stroke="none"
            fill={css('--line-subtle')}
            fillOpacity={0.7}
            isAnimationActive={false}
            name="Tolerância"
            activeDot={false}
          />
          {refLines.map((l, i) => (
            <ReferenceLine
              key={i}
              y={l.y}
              stroke={css(l.color)}
              strokeDasharray="6 4"
              strokeWidth={1.5}
            />
          ))}
          <ReferenceLine x={nowMin} stroke={css('--line-strong')} strokeWidth={1} />
          <Line
            dataKey="reference"
            stroke={css('--text-muted')}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
            name="Lote de ouro"
          />
          <Line
            dataKey="actual"
            stroke={css('--brand-blue')}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, stroke: css('--surface-card'), strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
            name="Lote atual"
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: css('--line-strong'), strokeWidth: 1 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
