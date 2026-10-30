import { ArrowRight } from 'lucide-react';
import { PHASES, TAGS, TAG_ORDER, getLimits } from '../../config/plant';
import { batchTiming, phaseConformity, phaseTrendRows } from '../../data/batchStats';
import { simulation } from '../../data/source';
import { tagStatus, type PlantState } from '../../data/store';
import { uiStore } from '../../data/ui';
import { formatDateTime, formatDuration, formatNumber, formatTime } from '../../lib/format';
import { EventTypeBadge } from '../hmi/AlarmList';
import { Panel } from '../hmi/Panel';
import { niceScale, TrendChart } from '../hmi/TrendChart';
import { cn } from '../ui/utils';

const processRate = () => simulation?.acceleration ?? 1;

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      <span className={cn('inline-block w-5', className)} />
      {label}
    </span>
  );
}

/** 4 mini gráficos da etapa atual: lote atual × lote de ouro, com tolerância e limites. */
export function PhaseTrendGrid({ plant }: { plant: PlantState }) {
  const phaseIndex = plant.snapshot?.batch.phaseIndex ?? 0;
  const phase = PHASES[phaseIndex];
  const d = phase.durationMin;
  const ticks = niceScale([0, d], 2).ticks.filter((t) => t <= d);
  const now = (plant.snapshot?.batch.phaseElapsedS ?? 0) / 60;

  return (
    <Panel
      title="Tendência da etapa atual"
      subtitle={`${phase.name} · 0 a ${formatNumber(d, 0)} min`}
      className="min-h-0"
      bodyClassName="grid min-h-0 grid-cols-4 gap-3 p-3"
      actions={
        <div className="flex items-center gap-4 text-[13px] text-ink-muted">
          <LegendSwatch className="h-0.5 bg-brand" label="Lote atual" />
          <LegendSwatch className="border-t-2 border-dashed border-ink-muted" label="Lote de ouro" />
          <LegendSwatch className="h-2.5 bg-line" label="Tolerância" />
          <LegendSwatch className="border-t-2 border-dashed border-st-warning" label="Alerta" />
          <LegendSwatch className="border-t-2 border-dashed border-st-critical" label="Crítico" />
        </div>
      }
    >
      {TAG_ORDER.map((tag) => {
        const cfg = TAGS[tag];
        const status = tagStatus(plant, tag);
        const value = plant.snapshot?.tags[tag];
        return (
          <div key={tag} className="flex min-h-0 flex-col">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-ink">{cfg.name}</span>
              <span
                className={cn(
                  'text-sm font-medium num',
                  status === 'critical' ? 'text-st-critical-text' : status === 'warning' ? 'text-st-warning-text' : status === 'bad' ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {value === undefined ? '—' : formatNumber(value, cfg.decimals)} {cfg.unit}
              </span>
            </div>
            <div className="min-h-0 flex-1">
              <TrendChart
                compact
                rows={phaseTrendRows(plant, tag, phaseIndex)}
                unit={cfg.unit}
                decimals={cfg.decimals}
                xDomain={[0, d]}
                xTicks={ticks}
                formatX={(x) => `${formatNumber(x, 0)} min`}
                formatXLong={(x) => `${formatNumber(x, 1)} min de etapa`}
                marker={now}
                limits={getLimits(tag, phaseIndex)}
              />
            </div>
          </div>
        );
      })}
    </Panel>
  );
}

/** Resumo do lote: início, previsão de término, tempo restante, progresso e conformidade. */
export function BatchSummary({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  if (!s) return <Panel title="Resumo do lote"><span className="text-ink-muted">Aguardando leitura…</span></Panel>;
  const t = batchTiming(s, plant.now, processRate());
  const conformity = phaseConformity(plant.phaseTrace, s.batch.phaseIndex);
  const rows: [string, React.ReactNode][] = [
    ['Início do lote', formatDateTime(t.startedAt).slice(0, 16)],
    [simulation ? 'Previsão de término*' : 'Previsão de término', s.batch.status === 'completed' ? 'Concluído' : formatDateTime(t.predictedEnd).slice(0, 16)],
    ['Restante na etapa', formatDuration(t.phaseRemainingS)],
    ['Conformidade (etapa)', conformity === null ? '—' : `${formatNumber(conformity * 100, 1)} % no lote de ouro`],
  ];
  return (
    <Panel title="Resumo do lote" subtitle={simulation ? `${s.batch.lot} · *no ritmo da demonstração` : s.batch.lot} className="min-h-0" bodyClassName="flex flex-col gap-1.5 px-4 py-2">
      <div>
        <div className="mb-1 flex items-baseline justify-between text-sm">
          <span className="text-ink-muted">Lote concluído</span>
          <span className="text-lg font-semibold text-ink num">{formatNumber(t.progress * 100, 0)} %</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-sm bg-sunken" role="progressbar" aria-valuenow={Math.round(t.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-st-info transition-[width] duration-200" style={{ width: `${t.progress * 100}%` }} />
        </div>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-[15px] num">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

/** Os 5 eventos mais recentes, com atalho para o histórico completo. */
export function RecentEvents({ plant }: { plant: PlantState }) {
  const events = plant.events.slice(0, 5);
  return (
    <Panel
      title="Últimos eventos"
      className="min-h-0"
      bodyClassName="flex min-h-0 flex-col px-4 py-2"
      actions={
        <button onClick={() => uiStore.navigate('alarms')} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
          ver todos (F4) <ArrowRight className="size-4" aria-hidden />
        </button>
      }
    >
      <ul className="flex flex-col divide-y divide-line">
        {events.map((e) => (
          <li key={e.seq} className="flex items-center gap-3 py-1.5 text-[15px]">
            <span className="w-[4.5rem] shrink-0 text-ink-muted num">{formatTime(e.time)}</span>
            <EventTypeBadge event={e} compact />
            <span className="min-w-0 flex-1 truncate text-ink" title={e.message}>{e.message}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
