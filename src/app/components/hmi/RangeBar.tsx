import type { TagConfig, TagLimits } from '../../config/plant';
import { formatNumber } from '../../lib/format';
import { cn } from '../ui/utils';

interface RangeBarProps {
  config: TagConfig;
  limits: TagLimits;
  value: number | null;
  muted?: boolean;
}

/** Casas decimais necessárias para escrever o passo (5 → 0, 0,5 → 1, 0,1 → 1). */
const stepDecimals = (step: number) => (Number.isInteger(step) ? 0 : String(step).split('.')[1].length);

/**
 * Escala fixa de engenharia (config). Se os limites da etapa ocupam menos de 25 %
 * da escala, mostra o zoom da etapa com extremos múltiplos de `zoomStep` — nunca
 * valores quebrados. O domínio não depende do valor medido (não "pula").
 */
export function barScale(config: TagConfig, lim: TagLimits): { min: number; max: number; zoomed: boolean } {
  const marks = [lim.critLo, lim.warnLo, lim.setpoint, lim.warnHi, lim.critHi].filter((x): x is number => x !== undefined);
  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const range = config.rangeMax - config.rangeMin;
  if (hi - lo >= range * 0.25) return { min: config.rangeMin, max: config.rangeMax, zoomed: false };
  const step = config.zoomStep;
  const round = (x: number) => Number(x.toFixed(6));
  return {
    min: Math.max(config.rangeMin, round(Math.floor((lo - step) / step) * step)),
    max: Math.min(config.rangeMax, round(Math.ceil((hi + step) / step) * step)),
    zoomed: true,
  };
}

/** Barra horizontal com faixas de alerta/crítico, setpoint e valor atual. */
export function RangeBar({ config, limits: lim, value, muted }: RangeBarProps) {
  const { min, max, zoomed } = barScale(config, lim);
  const pct = (x: number) => ((Math.min(max, Math.max(min, x)) - min) / (max - min)) * 100;
  const d = stepDecimals(zoomed ? config.zoomStep : max - min > 10 ? 1 : config.zoomStep);
  const fmt = (x: number) => formatNumber(x, d);

  const zones: { from: number; to: number; cls: string }[] = [];
  if (lim.critLo !== undefined) zones.push({ from: min, to: lim.critLo, cls: 'bg-st-critical/25' });
  if (lim.warnLo !== undefined) zones.push({ from: lim.critLo ?? min, to: lim.warnLo, cls: 'bg-st-warning/35' });
  if (lim.warnHi !== undefined) zones.push({ from: lim.warnHi, to: lim.critHi ?? max, cls: 'bg-st-warning/35' });
  if (lim.critHi !== undefined) zones.push({ from: lim.critHi, to: max, cls: 'bg-st-critical/25' });

  const below = value !== null && value < min;
  const above = value !== null && value > max;

  return (
    <div className={cn('select-none', muted && 'opacity-50')}>
      <div className="relative h-3.5 rounded-sm border border-line bg-sunken">
        {zones.map((z, i) => (
          <div key={i} className={cn('absolute inset-y-0', z.cls)} style={{ left: `${pct(z.from)}%`, width: `${Math.max(0, pct(z.to) - pct(z.from))}%` }} />
        ))}
        <div className="absolute -inset-y-1 w-0.5 bg-st-info" style={{ left: `calc(${pct(lim.setpoint)}% - 1px)` }} title="Setpoint" />
        {value !== null && (
          <div
            className="absolute -top-2 h-0 w-0 border-x-[7px] border-t-[9px] border-x-transparent border-t-ink transition-[left] duration-200 ease-out"
            style={{ left: `calc(${pct(value)}% - 7px)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px] text-ink-muted num">
        <span>{below ? `◄ ${fmt(min)}` : fmt(min)}</span>
        {zoomed && (
          <span className="text-center">
            faixa da etapa · escala {formatNumber(config.rangeMin, 0)}–{formatNumber(config.rangeMax, 0)} {config.unit}
          </span>
        )}
        <span>{above ? `${fmt(max)} ►` : fmt(max)}</span>
      </div>
    </div>
  );
}
