import { useMemo, useState } from 'react';
import { PHASES, TAGS, TAG_ORDER, getLimits, type TagId } from '../../config/plant';
import { goldenCurve, goldenValue } from '../../data/goldenBatch';
import type { PlantState } from '../../data/store';
import { formatDuration, formatNumber } from '../../lib/format';
import { TrendChart, type TrendRow } from '../hmi/TrendChart';
import { cn } from '../ui/utils';

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}

/** Análise de batelada da ETAPA ATUAL: lote atual × lote de ouro, com tolerância e limites da etapa. */
export function BatchAnalysis({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const phaseIndex = s?.batch.phaseIndex ?? 0;
  const phase = PHASES[phaseIndex];
  const [chosen, setChosen] = useState<TagId | null>(null);
  const [chosenForPhase, setChosenForPhase] = useState(phaseIndex);
  // Ao mudar de etapa volta para a variável principal da nova etapa
  if (chosenForPhase !== phaseIndex) {
    setChosenForPhase(phaseIndex);
    setChosen(null);
  }
  const tag = chosen ?? phase.primaryTag;
  const cfg = TAGS[tag];
  const limits = getLimits(tag, phaseIndex);

  const rows = useMemo<TrendRow[]>(() => {
    const band = (ref: number): [number, number] => [ref - limits.tolerance, ref + limits.tolerance];
    const golden: TrendRow[] = goldenCurve(tag, phaseIndex).map(({ tMin, v }) => ({ tMin, reference: v, band: band(v) }));
    const actual: TrendRow[] = plant.phaseTrace.map((p) => {
      const ref = goldenValue(tag, phaseIndex, p.tMin);
      return { tMin: p.tMin, reference: ref, band: band(ref), actual: p[tag] };
    });
    return [...golden, ...actual].sort((a, b) => a.tMin - b.tMin);
  }, [plant.phaseTrace, tag, phaseIndex, limits.tolerance]);

  const stats = useMemo(() => {
    const pts = plant.phaseTrace;
    if (!pts.length) return null;
    const devs = pts.map((p) => p[tag] - goldenValue(tag, phaseIndex, p.tMin));
    const meanAbs = devs.reduce((acc, d) => acc + Math.abs(d), 0) / devs.length;
    const inBand = devs.filter((d) => Math.abs(d) <= limits.tolerance).length / devs.length;
    return { current: devs[devs.length - 1], meanAbs, inBand };
  }, [plant.phaseTrace, tag, phaseIndex, limits.tolerance]);

  const fmt = (v: number) => formatNumber(v, cfg.decimals);
  const limitText = (lo?: number, hi?: number) => {
    const parts = [lo !== undefined && `≤ ${fmt(lo)}`, hi !== undefined && `≥ ${fmt(hi)}`].filter(Boolean);
    return parts.length ? `${parts.join(' / ')} ${cfg.unit}` : 'sem limite';
  };
  const elapsedS = s?.batch.phaseElapsedS ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Variável" className="inline-flex rounded border border-line bg-sunken p-0.5 text-sm">
          {TAG_ORDER.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={t === tag}
              onClick={() => setChosen(t)}
              className={cn('rounded px-3 py-1', t === tag ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
            >
              {TAGS[t].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
          <LegendItem swatch={<span className="inline-block h-0.5 w-5 bg-brand" />} label="Lote atual" />
          <LegendItem swatch={<span className="inline-block w-5 border-t-2 border-dashed border-ink-muted" />} label="Lote de ouro" />
          <LegendItem swatch={<span className="inline-block h-3 w-5 bg-line" />} label={`Tolerância ±${fmt(limits.tolerance)} ${cfg.unit}`} />
          <LegendItem swatch={<span className="inline-block w-5 border-t-2 border-dashed border-st-warning" />} label="Alerta" />
          <LegendItem swatch={<span className="inline-block w-5 border-t-2 border-dashed border-st-critical" />} label="Crítico" />
        </div>
      </div>

      <p className="text-xs text-ink-muted">
        Eixo horizontal: tempo de processo dentro da etapa <strong className="font-medium text-ink-default">{phase.name}</strong>{' '}
        (0 a {formatNumber(phase.durationMin, 0)} min). Escala vertical ajustada aos valores e limites desta etapa.{" "}
        <span className="num">
          Limites — alerta: {limitText(limits.warnLo, limits.warnHi)} · crítico: {limitText(limits.critLo, limits.critHi)}.
        </span>
      </p>

      <TrendChart
        rows={rows}
        unit={cfg.unit}
        decimals={cfg.decimals}
        durationMin={phase.durationMin}
        nowMin={elapsedS / 60}
        limits={limits}
      />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line text-center sm:grid-cols-4">
        {[
          ['Desvio atual', stats ? `${stats.current >= 0 ? '+' : '−'}${fmt(Math.abs(stats.current))} ${cfg.unit}` : '—'],
          ['Desvio médio', stats ? `${fmt(stats.meanAbs)} ${cfg.unit}` : '—'],
          ['Dentro da tolerância', stats ? `${formatNumber(stats.inBand * 100, 1)} %` : '—'],
          ['Tempo na etapa', `${formatDuration(elapsedS)} de ${formatDuration(phase.durationMin * 60)}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-surface px-2 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
            <dd className="text-base font-semibold text-ink num">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
