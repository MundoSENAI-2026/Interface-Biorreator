import { useMemo, useState } from 'react';
import { PHASES, TAGS, TAG_ORDER, TREND_PERIODS, getLimits, type TagId } from '../../config/plant';
import { goldenCurve, goldenValue } from '../../data/goldenBatch';
import type { PlantState } from '../../data/store';
import { formatDuration, formatNumber, formatTime } from '../../lib/format';
import { TrendChart, niceScale, type TrendRow } from '../hmi/TrendChart';
import { cn } from '../ui/utils';

type Period = (typeof TREND_PERIODS)[number]['id'];

const MAX_POINTS = 600;

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-ink-muted">{label}</span>
      <div role="tablist" aria-label={label} className="inline-flex rounded border border-line bg-sunken p-0.5">
        {options.map((o) => (
          <button
            key={String(o.id)}
            role="tab"
            aria-selected={o.id === value}
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded px-3 py-1 text-sm transition-colors duration-150',
              o.id === value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: { swatch: React.ReactNode; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          {i.swatch}
          {i.label}
        </span>
      ))}
    </div>
  );
}

function downsample<T>(points: T[], max: number): T[] {
  if (points.length <= max) return points;
  const step = points.length / max;
  return Array.from({ length: max }, (_, i) => points[Math.floor(i * step)]).concat(points[points.length - 1]);
}

/** Tela de tendências: etapa atual × lote de ouro, ou janela de tempo real. */
export function TrendsView({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const phaseIndex = s?.batch.phaseIndex ?? 0;
  const phase = PHASES[phaseIndex];
  const [chosen, setChosen] = useState<TagId | null>(null);
  const [period, setPeriod] = useState<Period>('phase');
  const tag = chosen ?? phase.primaryTag;
  const cfg = TAGS[tag];
  const limits = getLimits(tag, phaseIndex);
  const fmt = (v: number) => formatNumber(v, cfg.decimals);
  const signed = (v: number) => `${v >= 0 ? '+' : '−'}${fmt(Math.abs(v))} ${cfg.unit}`;

  const phaseMode = period === 'phase';
  const elapsedS = s?.batch.phaseElapsedS ?? 0;

  const chart = useMemo(() => {
    if (period === 'phase') {
      const band = (ref: number): [number, number] => [ref - limits.tolerance, ref + limits.tolerance];
      const golden: TrendRow[] = goldenCurve(tag, phaseIndex).map(({ tMin, v }) => ({ x: tMin, reference: v, band: band(v) }));
      const actual: TrendRow[] = plant.phaseTrace.map((p) => {
        const ref = goldenValue(tag, phaseIndex, p.tMin);
        return { x: p.tMin, reference: ref, band: band(ref), actual: p[tag] };
      });
      const devs = actual.map((r) => r.actual! - r.reference!);
      const stats: [string, string][] = [
        ['Desvio atual', devs.length ? signed(devs[devs.length - 1]) : '—'],
        ['Desvio médio', devs.length ? `${fmt(devs.reduce((a, d) => a + Math.abs(d), 0) / devs.length)} ${cfg.unit}` : '—'],
        ['Dentro da tolerância', devs.length ? `${formatNumber((devs.filter((d) => Math.abs(d) <= limits.tolerance).length / devs.length) * 100, 1)} %` : '—'],
        ['Tempo na etapa', `${formatDuration(elapsedS)} de ${formatDuration(phase.durationMin * 60)}`],
      ];
      const d = phase.durationMin;
      return {
        rows: [...golden, ...actual].sort((a, b) => a.x - b.x),
        xDomain: [0, d] as [number, number],
        xTicks: niceScale([0, d], 5).ticks.filter((t) => t <= d),
        formatX: (x: number) => `${formatNumber(x, 0)} min`,
        formatXLong: (x: number) => `${formatNumber(x, 1)} min de etapa`,
        marker: elapsedS / 60,
        stats,
      };
    }

    const end = plant.now;
    const start = end - period * 1000;
    const pts = plant.history[tag].filter((p) => p.t >= start);
    const vals = pts.map((p) => p.v);
    const stats: [string, string][] = [
      ['Atual', vals.length ? `${fmt(vals[vals.length - 1])} ${cfg.unit}` : '—'],
      ['Mínimo', vals.length ? `${fmt(Math.min(...vals))} ${cfg.unit}` : '—'],
      ['Máximo', vals.length ? `${fmt(Math.max(...vals))} ${cfg.unit}` : '—'],
      ['Média', vals.length ? `${fmt(vals.reduce((a, v) => a + v, 0) / vals.length)} ${cfg.unit}` : '—'],
    ];
    return {
      rows: downsample(pts, MAX_POINTS).map((p) => ({ x: p.t, actual: p.v })),
      xDomain: [start, end] as [number, number],
      xTicks: [0, 1, 2, 3, 4, 5].map((i) => start + ((end - start) * i) / 5),
      formatX: (x: number) => formatTime(x).slice(0, period <= 300 ? 8 : 5),
      formatXLong: (x: number) => formatTime(x),
      marker: undefined,
      stats,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, tag, phaseIndex, plant.phaseTrace, plant.history, plant.now, limits.tolerance, elapsedS]);

  const limitText = (lo?: number, hi?: number) => {
    const parts = [lo !== undefined && `≤ ${fmt(lo)}`, hi !== undefined && `≥ ${fmt(hi)}`].filter(Boolean);
    return parts.length ? `${parts.join(' / ')} ${cfg.unit}` : 'sem limite';
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Variável" value={tag} options={TAG_ORDER.map((t) => ({ id: t, label: TAGS[t].name }))} onChange={setChosen} />
        <Segmented label="Período" value={period} options={TREND_PERIODS.map((p) => ({ id: p.id, label: p.label }))} onChange={setPeriod} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
        <Legend
          items={[
            { swatch: <span className="inline-block h-0.5 w-6 bg-brand" />, label: phaseMode ? 'Lote atual' : `${cfg.name} (${cfg.id})` },
            ...(phaseMode
              ? [
                  { swatch: <span className="inline-block w-6 border-t-2 border-dashed border-ink-muted" />, label: 'Lote de ouro' },
                  { swatch: <span className="inline-block h-3 w-6 bg-line" />, label: `Tolerância ±${fmt(limits.tolerance)} ${cfg.unit}` },
                ]
              : []),
            { swatch: <span className="inline-block w-6 border-t-2 border-dashed border-st-warning" />, label: `Alerta ${limitText(limits.warnLo, limits.warnHi)}` },
            { swatch: <span className="inline-block w-6 border-t-2 border-dashed border-st-critical" />, label: `Crítico ${limitText(limits.critLo, limits.critHi)}` },
          ]}
        />
        <p className="text-[13px] text-ink-muted">
          {phaseMode
            ? `Eixo: tempo de processo na etapa ${phase.name} (0 a ${formatNumber(phase.durationMin, 0)} min)`
            : 'Eixo: horário real · limites da etapa atual'}
        </p>
      </div>

      <div className="min-h-[240px] flex-1">
        <TrendChart
          rows={chart.rows}
          unit={cfg.unit}
          decimals={cfg.decimals}
          xDomain={chart.xDomain}
          xTicks={chart.xTicks}
          formatX={chart.formatX}
          formatXLong={chart.formatXLong}
          marker={chart.marker}
          limits={limits}
        />
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded border border-line bg-line text-center md:grid-cols-4">
        {chart.stats.map(([label, value]) => (
          <div key={label} className="bg-surface px-2 py-2">
            <dt className="text-[13px] uppercase tracking-wide text-ink-muted">{label}</dt>
            <dd className="text-xl font-semibold text-ink num">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
