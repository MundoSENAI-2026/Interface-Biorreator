import type { TagConfig, TagLimits } from '../../config/plant';
import { formatNumber } from '../../lib/format';
import { cn } from '../ui/utils';

interface RangeBarProps {
  config: TagConfig;
  limits: TagLimits;
  value: number | null;
  muted?: boolean;
}

/**
 * Domínio estável (não depende do valor): faixa completa do instrumento, ou
 * zoom em torno dos limites quando eles ocupam pouco da faixa.
 */
function domain(config: TagConfig, lim: TagLimits): [number, number] {
  const marks = [lim.critLo, lim.warnLo, lim.setpoint, lim.warnHi, lim.critHi].filter(
    (x): x is number => x !== undefined,
  );
  const lo = Math.min(...marks);
  const hi = Math.max(...marks);
  const range = config.rangeMax - config.rangeMin;
  if (hi - lo >= range * 0.25) return [config.rangeMin, config.rangeMax];
  const pad = Math.max((hi - lo) * 0.25, config.deadband * 4);
  return [Math.max(config.rangeMin, lo - pad), Math.min(config.rangeMax, hi + pad)];
}

/** Barra horizontal com faixas de alerta/crítico, setpoint e valor atual. */
export function RangeBar({ config, limits: lim, value, muted }: RangeBarProps) {
  const [dMin, dMax] = domain(config, lim);
  const pct = (x: number) => ((Math.min(dMax, Math.max(dMin, x)) - dMin) / (dMax - dMin)) * 100;

  const zones: { from: number; to: number; cls: string }[] = [];
  if (lim.critLo !== undefined) zones.push({ from: dMin, to: lim.critLo, cls: 'bg-st-critical/25' });
  if (lim.warnLo !== undefined) zones.push({ from: lim.critLo ?? dMin, to: lim.warnLo, cls: 'bg-st-warning/30' });
  if (lim.warnHi !== undefined) zones.push({ from: lim.warnHi, to: lim.critHi ?? dMax, cls: 'bg-st-warning/30' });
  if (lim.critHi !== undefined) zones.push({ from: lim.critHi, to: dMax, cls: 'bg-st-critical/25' });

  const below = value !== null && value < dMin;
  const above = value !== null && value > dMax;
  const fmt = (x: number) => formatNumber(x, config.decimals);

  return (
    <div className={cn('select-none', muted && 'opacity-50')}>
      <div className="relative h-3 rounded-sm border border-line bg-sunken">
        {zones.map((z, i) => (
          <div
            key={i}
            className={cn('absolute inset-y-0', z.cls)}
            style={{ left: `${pct(z.from)}%`, width: `${Math.max(0, pct(z.to) - pct(z.from))}%` }}
          />
        ))}
        {/* Setpoint */}
        <div className="absolute -inset-y-1 w-0.5 bg-st-info" style={{ left: `calc(${pct(lim.setpoint)}% - 1px)` }} title="Setpoint" />
        {/* Valor atual */}
        {value !== null && (
          <div
            className="absolute -top-1.5 h-0 w-0 border-x-[6px] border-t-[8px] border-x-transparent border-t-ink"
            style={{ left: `calc(${pct(value)}% - 6px)` }}
            aria-hidden
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-muted num">
        <span>{below ? `◄ abaixo de ${fmt(dMin)}` : fmt(dMin)}</span>
        <span>{above ? `acima de ${fmt(dMax)} ►` : fmt(dMax)}</span>
      </div>
    </div>
  );
}
