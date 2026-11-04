import { ArrowRight } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { PHASES, TAGS, TAG_ORDER, getLimits } from '../../config/plant';
import { alarmStats } from '../../data/alarmStats';
import { BATCH_NOMINAL_S, batchTiming, phaseConformity, phaseTrendRows } from '../../data/batchStats';
import { goldenValue } from '../../data/goldenBatch';
import { plantStore, simulation } from '../../data/source';
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
        <LegendSwatch className="border-t-2 border-dashed border-ink-muted" label={plantStore.source.kind === 'equipamento' ? 'Lote de ouro (referência)' : 'Lote de ouro'} />
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
      {simulation && <TimeValue label={`Término previsto (×${formatNumber(processRate(), 0)})`} value={formatTime(timing.predictedEnd).slice(0, 5)} />}
    </dl>
    {/* Indicadores do lote em 13 px (antes 9–10 px) */}
    <dl className="mt-auto grid grid-cols-3 gap-1.5 border-t border-line pt-1.5">
      <MiniMetric label="Conformidade da etapa" value={conformity === null ? 'Sem dados' : `${formatNumber(conformity * 100, 0)} %`} />
      <MiniMetric label="Desvio de temperatura" value={meanTempDeviation === null ? 'Sem dados' : `${formatNumber(meanTempDeviation, 1)} °C`} />
      <MiniMetric label="Alarmes no lote" value={String(lotAlarms)} />
    </dl>
  </Panel>;
}

function TimeValue({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 items-center justify-between gap-1"><dt className="text-ink-muted">{label}</dt><dd className="shrink-0 text-right font-medium text-ink">{value}</dd></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="flex min-w-0 flex-col justify-center rounded bg-sunken px-1.5 py-1 text-center">
    <dt className="text-[13px] leading-4 text-ink-muted">{label}</dt>
    <dd className="text-[15px] font-semibold leading-5 text-ink num">{value}</dd>
  </div>;
}

/** Latest events in a compact, fixed-height list. */
export function RecentEvents({ plant }: { plant: PlantState }) {
  const listRef = useRef<HTMLUListElement>(null);
  const [visibleRows, setVisibleRows] = useState(8);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    // Linhas de ~36 px (mensagem em até 2 linhas)
    const updateRows = () => setVisibleRows(Math.max(3, Math.min(8, Math.floor(list.clientHeight / 36))));
    updateRows();
    const observer = new ResizeObserver(updateRows);
    observer.observe(list);
    return () => observer.disconnect();
  }, []);
  const events = plant.events.slice(0, visibleRows);
  return <Panel title="Últimos eventos" className="min-h-0" bodyClassName="flex min-h-0 flex-col p-4" actions={<button onClick={() => uiStore.navigate('alarms')} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">ver todos (F4) <ArrowRight className="size-4" aria-hidden /></button>}>
    <ul ref={listRef} className="grid min-h-0 flex-1 divide-y divide-line" style={{ gridTemplateRows: `repeat(${Math.max(events.length, 1)}, minmax(0, 1fr))` }}>
      {events.map((event) => <li key={event.seq} className="grid min-h-0 grid-cols-[2.75rem_6.5rem_minmax(0,1fr)] items-center gap-2 py-0.5 text-[13px] 2xl:grid-cols-[2.75rem_6.5rem_minmax(0,1fr)_5.5rem]">
        <span className="text-ink-muted num">{formatTime(event.time).slice(0, 5)}</span>
        <EventTypeBadge event={event} />
        <span className="line-clamp-2 min-w-0 leading-4 text-ink">{event.message}</span>
        {/* Usuário só na tela larga: no notebook a mensagem precisa da largura */}
        <span className={cn('hidden text-right 2xl:inline', event.category === 'operator' ? 'font-medium text-st-info' : 'text-ink-muted')}>{event.user}</span>
      </li>)}
    </ul>
  </Panel>;
}
