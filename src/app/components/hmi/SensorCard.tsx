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
  bad: 'text-ink-muted',
};

export function SensorCard({ config, value, limits, status, history, windowS }: SensorCardProps) {
  const bad = status === 'bad';
  const slope = slopePerMinute(history);
  const trend = Math.abs(slope) < config.trendThresholdPerMin ? 0 : Math.sign(slope);
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : ArrowRight;
  const fmt = (x: number | undefined) => (x === undefined ? '—' : formatNumber(x, config.decimals));
  const range = (lo?: number, hi?: number) =>
    lo === undefined && hi === undefined ? '—' : [lo !== undefined && `≤ ${fmt(lo)}`, hi !== undefined && `≥ ${fmt(hi)}`].filter(Boolean).join(' / ');

  return (
    <article
      className={cn(
        'flex h-full flex-col gap-2 rounded-md border border-l-4 border-line bg-surface px-4 py-2.5 transition-colors duration-200',
        ACCENT[status],
        bad && 'bad-quality',
      )}
      aria-label={`${config.name} ${config.id}`}
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3 className="text-[17px] font-semibold leading-tight text-ink">{config.name}</h3>
          <span className="font-mono text-[13px] text-ink-muted">{config.id}</span>
        </div>
        <StatusBadge status={status} size="md" />
      </header>

      <div className="flex items-end justify-between gap-2">
        <div className={cn('-mx-1.5 flex items-baseline gap-2 rounded px-1.5 transition-colors duration-200 num', VALUE_STYLE[status])}>
          <span className="text-4xl font-semibold leading-none tracking-tight 2xl:text-5xl">{value === null ? '—' : formatNumber(value, config.decimals)}</span>
          <span className="text-xl font-medium">{config.unit}</span>
        </div>
        <div className="mb-1 flex items-center gap-1 whitespace-nowrap text-sm text-ink-muted num" title="Tendência no último minuto">
          {bad ? (
            'Tendência indisponível'
          ) : (
            <>
              <TrendIcon className="size-4" aria-hidden />
              {slope >= 0 ? '+' : '−'}
              {formatNumber(Math.abs(slope), config.decimals)} {config.unit}/min
            </>
          )}
        </div>
      </div>
      {bad && <p className="-mt-1 text-sm font-medium text-ink-muted">Dado não confiável — última leitura válida</p>}

      <div className="grid grid-cols-[auto_1fr] items-center gap-2">
        <span className="text-[13px] text-ink-muted">{Math.round(windowS / 60)} min</span>
        <Sparkline points={history} limits={limits} minSpan={config.deadband * 6} windowS={windowS} muted={bad} height={32} />
      </div>

      <RangeBar config={config} limits={limits} value={value} muted={bad} />

      <dl className="mt-auto grid grid-cols-1 gap-x-2 gap-y-0.5 border-t border-line pt-1.5 num 2xl:grid-cols-3">
        <div className="flex items-baseline justify-between gap-2 2xl:block">
          <dt className="text-[13px] text-ink-muted">Setpoint</dt>
          <dd className="text-sm font-medium text-st-info">{fmt(limits.setpoint)} {config.unit}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 2xl:block">
          <dt className="text-[13px] text-ink-muted">Alerta</dt>
          <dd className="whitespace-nowrap text-sm text-ink-default">{range(limits.warnLo, limits.warnHi)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2 2xl:block">
          <dt className="text-[13px] text-ink-muted">Crítico</dt>
          <dd className="whitespace-nowrap text-sm text-ink-default">{range(limits.critLo, limits.critHi)}</dd>
        </div>
      </dl>
    </article>
  );
}
