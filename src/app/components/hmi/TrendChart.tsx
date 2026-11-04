import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ReferenceArea,
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
  /** Escala de engenharia da tag: o eixo Y nunca sai dela (ex.: pressão 0–2, nível 0–100). */
  range?: [number, number];
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
export function TrendChart({ rows, unit, decimals, xDomain, xTicks, formatX, formatXLong, marker, limits, className, compact, range }: TrendChartProps) {
  const axis = compact ? { ...AXIS, fontSize: 13 } : AXIS;
  const fmt = (v: number) => formatNumber(v, decimals);
  const values = rows.flatMap((r) => [r.actual, r.reference, r.band?.[0], r.band?.[1]].filter((v): v is number => v !== undefined));
  for (const l of [limits.warnLo, limits.warnHi, limits.critLo, limits.critHi]) if (l !== undefined) values.push(l);
  const rawScale = niceScale(values.length ? values : [0, 1], compact ? 3 : 5);
  // Recorta na escala da tag (a faixa de tolerância do lote de ouro pode passar de 0 para baixo)
  const domain: [number, number] = range
    ? [Math.max(rawScale.domain[0], range[0]), Math.min(rawScale.domain[1], range[1])]
    : rawScale.domain;
  const scale = { domain, ticks: rawScale.ticks.filter((tick) => tick >= domain[0] - 1e-9 && tick <= domain[1] + 1e-9) };
  const tickDecimals = scale.ticks.length > 1 && scale.ticks[1] - scale.ticks[0] < 1 ? decimals : 0;
  const hasReference = rows.some((r) => r.reference !== undefined);

  const [yMin, yMax] = scale.domain;
  // "agora" do lado que tem espaço: à direita da linha no início do eixo (longe dos rótulos do eixo Y)
  const markerOnLeft = marker !== undefined && marker - xDomain[0] < (xDomain[1] - xDomain[0]) * 0.75;

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
    <div className={cn('flex h-full min-h-0 w-full flex-col', className)}>
      {/* Unidade numa linha própria, acima do eixo Y (não sobrepõe o primeiro rótulo) */}
      {!compact && <div className="h-5 shrink-0 pl-1 text-[13px] font-semibold text-ink-muted">{unit}</div>}
      <div className="min-h-0 flex-1">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={compact ? { top: 6, right: 8, bottom: 0, left: 0 } : { top: 10, right: 20, bottom: 4, left: 4 }}>
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
            interval={0}
            tick={axis}
            tickLine={false}
            axisLine={false}
            width={compact ? 44 : 64}
            tickFormatter={(v) => formatNumber(v, tickDecimals)}
            allowDataOverflow
          />
          {hasReference && (
            <Area dataKey="band" stroke="none" fill={css('--line-subtle')} fillOpacity={0.8} isAnimationActive={false} activeDot={false} />
          )}
          {limits.warnLo !== undefined && limits.critLo === undefined && <ReferenceArea y1={yMin} y2={Math.min(yMax, limits.warnLo)} fill={css('--status-warning-bg')} fillOpacity={0.85} ifOverflow="hidden" />}
          {limits.warnHi !== undefined && limits.critHi !== undefined && <ReferenceArea y1={Math.min(yMax, limits.warnHi)} y2={Math.min(yMax, limits.critHi)} fill={css('--status-warning-bg')} fillOpacity={0.85} ifOverflow="hidden" />}
          {limits.critHi !== undefined && <ReferenceArea y1={Math.max(yMin, limits.critHi)} y2={yMax} fill={css('--status-critical-bg')} fillOpacity={0.9} ifOverflow="hidden" />}
          {limits.critLo !== undefined && <ReferenceArea y1={yMin} y2={Math.min(yMax, limits.critLo)} fill={css('--status-critical-bg')} fillOpacity={0.9} ifOverflow="hidden" />}
          {limits.warnLo !== undefined && limits.critLo !== undefined && <ReferenceArea y1={Math.max(yMin, limits.critLo)} y2={Math.min(yMax, limits.warnLo)} fill={css('--status-warning-bg')} fillOpacity={0.85} ifOverflow="hidden" />}
          {marker !== undefined && <ReferenceLine x={marker} stroke={css('--line-strong')} strokeWidth={1} label={{ value: 'agora', position: markerOnLeft ? 'insideTopLeft' : 'insideTopRight', fill: css('--text-muted'), fontSize: 13 }} />}
          {hasReference && (
            <Line dataKey="reference" stroke={css('--text-muted')} strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />
          )}
          <Line
            dataKey="actual"
            stroke={css('--brand-blue')}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, stroke: css('--surface-card'), strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Tooltip content={renderTooltip} cursor={{ stroke: css('--line-strong'), strokeWidth: 1 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
