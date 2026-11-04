import { ArrowRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { PHASES, TAGS, TAG_ORDER, getLimits } from '../../config/plant';
import { alarmStats } from '../../data/alarmStats';
import { BATCH_NOMINAL_S, batchTiming, phaseConformity, phaseTrendRows } from '../../data/batchStats';
import { goldenValue } from '../../data/goldenBatch';
import { simulation } from '../../data/source';
import { freshness, tagStatus, type PlantState } from '../../data/store';
import { uiStore } from '../../data/ui';
import { formatDateTime, formatDuration, formatNumber, formatTime } from '../../lib/format';
import { Panel } from '../hmi/Panel';
import { EventTypeBadge } from '../hmi/AlarmList';
import { niceScale, TrendChart } from '../hmi/TrendChart';
import { cn } from '../ui/utils';

const processRate = () => simulation?.acceleration ?? 1;

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5 whitespace-nowrap"><span className={cn('inline-block w-5', className)} />{label}</span>;
}

/** Four compact trends for the current phase and golden batch. */
export function PhaseTrendGrid({ plant }: { plant: PlantState }) {
  const phaseIndex = plant.snapshot?.batch.phaseIndex ?? 0;
  const phase = PHASES[phaseIndex];
  const duration = phase.durationMin;
  const ticks = [...Array.from({ length: Math.floor(duration / 120) + 1 }, (_, i) => i * 120), duration].filter((tick, index, all) => all.indexOf(tick) === index);
  const now = (plant.snapshot?.batch.phaseElapsedS ?? 0) / 60;

  return (
    <Panel
      title="Tendência da etapa atual"
      subtitle={`${phase.name} · 0 a ${formatNumber(duration, 0)} min`}
      className="min-h-0"
      bodyClassName="grid min-h-0 grid-cols-4 gap-3 p-4"
      actions={<div className="flex items-center gap-3 text-xs text-ink-muted">
        <LegendSwatch className="h-0.5 bg-brand" label="Lote atual" />
        <LegendSwatch className="border-t-2 border-dashed border-ink-muted" label="Lote de ouro" />
        <LegendSwatch className="h-2.5 bg-line" label="Tolerância" />
        <LegendSwatch className="h-2.5 bg-st-warning-bg" label="Faixa de alerta" />
        <LegendSwatch className="h-2.5 bg-st-critical-bg" label="Faixa crítica" />
      </div>}
    >
      {TAG_ORDER.map((tag) => {
        const config = TAGS[tag];
        const status = tagStatus(plant, tag);
        const value = plant.snapshot?.tags[tag];
        return <div key={tag} className="flex min-h-0 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-ink">{config.name}</span>
            <span title={freshness(plant, tag)?.title} className={cn('text-sm font-bold num', status === 'critical' ? 'text-st-critical-text' : status === 'warning' ? 'text-st-warning-text' : status === 'bad' ? 'text-ink-muted' : 'text-ink')}>
              {value === undefined ? '—' : formatNumber(value, config.decimals)} {config.unit}
            </span>
          </div>
          <div className="min-h-0 flex-1">
            <TrendChart
              compact
              rows={phaseTrendRows(plant, tag, phaseIndex)}
              unit={config.unit}
              decimals={config.decimals}
              xDomain={[0, duration]}
              xTicks={ticks}
              formatX={(x) => `${formatNumber(x, 0)} min`}
              formatXLong={(x) => `${formatNumber(x, 1)} min de etapa`}
              marker={now}
              limits={getLimits(tag, phaseIndex)}
              range={[TAGS[tag].rangeMin, TAGS[tag].rangeMax]}
            />
          </div>
        </div>;
      })}
    </Panel>
  );
}

/** Batch times use process time consistently; only the estimated finish uses wall time. */
export function BatchSummary({ plant }: { plant: PlantState }) {
  const snapshot = plant.snapshot;
  if (!snapshot) return <Panel title="Resumo do lote"><span className="text-ink-muted">Aguardando leitura…</span></Panel>;

  const timing = batchTiming(snapshot, plant.now, processRate());
  const phaseIndex = snapshot.batch.phaseIndex;
  const conformity = phaseConformity(plant.phaseTrace, phaseIndex);
  const remainingS = Math.max(0, BATCH_NOMINAL_S - timing.elapsedS);
  const tempTrace = plant.phaseTrace.filter((point) => Number.isFinite(point.TIT_100_01));
  const meanTempDeviation = tempTrace.length
    ? tempTrace.reduce((sum, point) => sum + Math.abs(point.TIT_100_01 - goldenValue('TIT_100_01', phaseIndex, point.tMin)), 0) / tempTrace.length
    : null;
  const lotAlarms = alarmStats(plant.events, snapshot.batch.startedAt, plant.now).totalLot;
  const completedRatio = snapshot.batch.status === 'completed' ? 1 : Math.max(0, Math.min(1, snapshot.batch.phaseElapsedS / (PHASES[phaseIndex].durationMin * 60)));

  return <Panel title="Resumo do lote" subtitle={snapshot.batch.lot || 'lote não informado'} className="min-h-0" bodyClassName="flex min-h-0 flex-col gap-1 p-4">
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between text-xs"><span className="text-ink-muted">Lote concluído</span><span className="font-semibold text-ink num">{formatNumber(timing.progress * 100, 0)} %</span></div>
      <div className="flex h-2.5 overflow-hidden rounded-sm bg-sunken" role="progressbar" aria-valuenow={Math.round(timing.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
        {PHASES.map((phase, index) => {
          const progress = index < phaseIndex || snapshot.batch.status === 'completed' ? 1 : index === phaseIndex ? completedRatio : 0;
          const base = index < phaseIndex || snapshot.batch.status === 'completed' ? 'bg-brand' : index === phaseIndex ? 'bg-brand-soft' : 'bg-sunken';
          return <div key={phase.id} className={cn('h-full border-r border-surface last:border-0', base)} style={{ width: `${phase.durationMin / (BATCH_NOMINAL_S / 60) * 100}%` }} title={`${phase.name}: ${Math.round(progress * 100)}%`}><div className="h-full bg-brand" style={{ width: `${progress * 100}%` }} /></div>;
        })}
      </div>
    </div>
    <dl className="grid grid-cols-2 gap-x-3 gap-y-0 text-xs leading-4 num">
      <TimeValue label="Início do lote" value={formatDateTime(timing.startedAt).slice(0, 16)} />
      <TimeValue label="Tempo decorrido" value={formatDuration(timing.elapsedS)} />
      <TimeValue label="Tempo total previsto" value={formatDuration(BATCH_NOMINAL_S)} />
      <TimeValue label="Restante no lote" value={formatDuration(remainingS)} />
      <TimeValue label="Restante na etapa" value={formatDuration(timing.phaseRemainingS)} />
    </dl>
    {simulation && <p className="text-[11px] leading-4 text-ink-muted">Término real estimado (×{formatNumber(processRate(), 0)}): {formatTime(timing.predictedEnd).slice(0, 5)}</p>}
    <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-line pt-1">
      <MiniMetric label="Conformidade" value={conformity === null ? '—' : `${formatNumber(conformity * 100, 0)}%`} detail="etapa" />
      <MiniMetric label="Desvio médio" value={meanTempDeviation === null ? '—' : `${formatNumber(meanTempDeviation, 1)} °C`} detail="temperatura" />
      <MiniMetric label="Alarmes" value={String(lotAlarms)} detail="no lote" />
    </div>
  </Panel>;
}

function TimeValue({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-center justify-between gap-1"><dt className="truncate text-ink-muted">{label}</dt><dd className="shrink-0 text-right font-medium text-ink">{value}</dd></div>;
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="min-w-0 rounded bg-sunken px-1.5 py-0.5 text-center">
    <div className="truncate text-[10px] leading-3 text-ink-muted">{label}</div><div className="truncate text-xs font-semibold leading-4 text-ink num">{value}</div><div className="truncate text-[9px] leading-3 text-ink-muted">{detail}</div>
  </div>;
}

/** Latest events in a compact, fixed-height list. */
export function RecentEvents({ plant }: { plant: PlantState }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [visibleRows, setVisibleRows] = useState(8);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const updateRows = () => setVisibleRows(Math.max(6, Math.min(8, Math.floor(list.clientHeight / 22))));
    updateRows();
    const observer = new ResizeObserver(updateRows);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const events = plant.events.slice(0, visibleRows);
  return <Panel title="Últimos eventos" className="min-h-0" bodyClassName="flex min-h-0 flex-col p-4" actions={<button onClick={() => uiStore.navigate('alarms')} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">ver todos (F4) <ArrowRight className="size-4" aria-hidden /></button>}>
    <ul ref={listRef} className="grid min-h-0 flex-1 divide-y divide-line" style={{ gridTemplateRows: `repeat(${Math.max(events.length, 1)}, minmax(0, 1fr))` }}>
      {events.map((event) => <li key={event.seq} className="grid min-h-0 grid-cols-[3.7rem_5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 py-0.5 text-xs">
        <span className="text-ink-muted num">{formatTime(event.time).slice(0, 5)}</span>
        <EventTypeBadge event={event} />
        <span className="min-w-0 truncate text-ink" title={event.message}>{event.message}</span>
        <span className="truncate text-right text-ink-muted" title={event.user ?? 'Sistema (CLP)'}>{event.category === 'operator' ? (event.user ?? 'Operador 01') : 'Sistema (CLP)'}</span>
      </li>)}
    </ul>
  </Panel>;
}
