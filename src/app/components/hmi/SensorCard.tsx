import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { TagConfig, TagLimits } from '../../config/plant';
import type { TagStatus } from '../../data/store';
import type { TrendPoint } from '../../data/types';
import { formatNumber } from '../../lib/format';
import { slopePerMinute } from '../../lib/trend';
import { cn } from '../ui/utils';
import { RangeBar } from './RangeBar';
import { Sparkline } from './Sparkline';
import { StatusBadge } from './StatusBadge';

interface SensorCardProps {
  config: TagConfig;
  value: number | null;
  limits: TagLimits;
  status: TagStatus;
  history: TrendPoint[];
  windowS: number;
}

const ACCENT: Record<TagStatus, string> = {
  normal: 'border-l-line-strong',
  warning: 'border-l-st-warning',
  critical: 'border-l-st-critical',
  bad: 'border-l-st-offline',
};

const VALUE_STYLE: Record<TagStatus, string> = {
  normal: 'text-ink',
  warning: 'bg-st-warning-bg text-st-warning-text',
  critical: 'bg-st-critical-bg text-st-critical-text',
  bad: 'text-ink-disabled',
};

export function SensorCard({ config, value, limits, status, history, windowS }: SensorCardProps) {
  const bad = status === 'bad';
  const slope = slopePerMinute(history);
  const trend = Math.abs(slope) < config.trendThresholdPerMin ? 0 : Math.sign(slope);
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : ArrowRight;
  const fmt = (x: number | undefined) => (x === undefined ? '—' : formatNumber(x, config.decimals));
  const range = (lo?: number, hi?: number) =>
    lo === undefined && hi === undefined ? '—' : `${lo === undefined ? '' : `≤ ${fmt(lo)}`}${lo !== undefined && hi !== undefined ? '  ·  ' : ''}${hi === undefined ? '' : `≥ ${fmt(hi)}`}`;

  return (
    <article
      className={cn(
        'flex flex-col gap-3 rounded-md border border-l-4 border-line bg-surface p-4',
        ACCENT[status],
        bad && 'bad-quality',
      )}
      aria-label={`${config.name} ${config.id}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">{config.name}</h3>
          <p className="font-mono text-xs text-ink-muted">{config.id}</p>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="flex items-end justify-between gap-2">
        <div className={cn('rounded px-1.5 -mx-1.5 num', VALUE_STYLE[status])}>
          <span className="text-[34px] font-semibold leading-tight tracking-tight">
            {value === null ? '—' : formatNumber(value, config.decimals)}
          </span>
          <span className="ml-1.5 text-base font-medium">{config.unit}</span>
        </div>
        <div
          className={cn('mb-1.5 flex items-center gap-1 text-xs num', bad ? 'text-ink-disabled' : 'text-ink-muted')}
          title="Tendência no último minuto"
        >
          {bad ? (
            <span>Tendência indisponível</span>
          ) : (
            <>
              <TrendIcon className="size-4" aria-hidden />
              <span>
                {slope >= 0 ? '+' : '−'}
                {formatNumber(Math.abs(slope), config.decimals)} {config.unit}/min
              </span>
            </>
          )}
        </div>
      </div>

      {bad && <p className="-mt-2 text-xs font-medium text-ink-muted">Dado não confiável — última leitura válida</p>}

      <div>
        <Sparkline points={history} limits={limits} minSpan={config.deadband * 6} windowS={windowS} muted={bad} />
        <p className="mt-0.5 text-[11px] text-ink-muted">Últimos {Math.round(windowS / 60)} min</p>
      </div>

      <RangeBar config={config} limits={limits} value={value} muted={bad} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-2.5 text-xs num">
        <dt className="text-ink-muted">Setpoint</dt>
        <dd className="text-right font-medium text-st-info">
          {fmt(limits.setpoint)} {config.unit}
        </dd>
        <dt className="text-ink-muted">Alerta</dt>
        <dd className="text-right text-ink-default">{range(limits.warnLo, limits.warnHi)}</dd>
        <dt className="text-ink-muted">Crítico</dt>
        <dd className="text-right text-ink-default">{range(limits.critLo, limits.critHi)}</dd>
      </dl>
    </article>
  );
}
