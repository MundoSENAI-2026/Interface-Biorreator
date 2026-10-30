import { ArrowDown, ArrowUp, CircleCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  HEALTH_CRIT,
  HEALTH_WARN,
  MAINTENANCE_PLAN,
  ML_INSIGHTS,
  VIBRATION_LIMIT_MM_S,
  ASSETS,
  probabilityHistory,
  vibrationHistory,
  type AssetHealth,
  type DailyPoint,
  type TaskType,
} from '../../data/mlInsights';
import { ML_MODEL, TAGS, VALVES, type TagId } from '../../config/plant';
import { daysUntil, formatDate, formatNumber, parseLocalDate, pluralize } from '../../lib/format';
import { Panel } from '../hmi/Panel';
import { StatusBadge, type BadgeStatus } from '../hmi/StatusBadge';
import { cn } from '../ui/utils';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const css = (name: string) => `var(${name})`;
const AXIS = { fontSize: 12, fill: css('--text-muted') };
const pct = (value: number, decimals = 1) => `${formatNumber(value * 100, decimals)} %`;
const shortDate = (timestamp: number) => formatDate(timestamp).slice(0, 5);

type DueKind = 'overdue' | 'soon' | 'upcoming';

function dueStatus(iso: string, today: Date): { kind: DueKind; label: string } {
  const days = daysUntil(parseLocalDate(iso), today);
  if (days < 0) return { kind: 'overdue', label: `Atrasada há ${pluralize(-days, 'dia', 'dias')}` };
  if (days <= 7) return { kind: 'soon', label: `Em ${pluralize(days, 'dia', 'dias')}` };
  return { kind: 'upcoming', label: `Em ${pluralize(days, 'dia', 'dias')}` };
}

function DueLabel({ kind, children }: { kind: DueKind; children: React.ReactNode }) {
  const style = kind === 'overdue'
    ? 'border-st-critical/40 bg-st-critical-bg text-st-critical-text'
    : kind === 'soon'
      ? 'border-st-warning/50 bg-st-warning-bg text-st-warning-text'
      : 'border-line bg-sunken text-ink-muted';
  return <span className={cn('inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium leading-4', style)}>{children}</span>;
}

const TASK_STYLE: Record<TaskType, string> = {
  Preventiva: 'border-line bg-st-normal-bg text-ink-default',
  Preditiva: 'border-st-info/40 bg-st-info-bg text-st-info',
  Calibração: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

function TaskTypeBadge({ type }: { type: TaskType }) {
  return <span className={cn('inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium leading-4', TASK_STYLE[type])}>{type}</span>;
}

function DailyChart({
  data,
  decimals,
  unit,
  domain,
  ticks,
  warning,
  critical,
}: {
  data: DailyPoint[];
  decimals: number;
  unit: string;
  domain: [number, number];
  ticks: number[];
  warning: number;
  critical: number;
}) {
  const xTicks = data.filter((_, index) => index % 7 === 0).map((point) => point.t);
  const last = data[data.length - 1];
  return (
    <div className="h-full min-h-0 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={css('--line-subtle')} strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[data[0]?.t ?? 0, last?.t ?? 1]}
            ticks={xTicks}
            interval={0}
            tickFormatter={shortDate}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: css('--line-strong') }}
            height={22}
          />
          <YAxis
            domain={domain}
            ticks={ticks}
            interval={0}
            tick={AXIS}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(value) => formatNumber(value, decimals === 0 ? 0 : 1)}
            label={{ value: unit, angle: -90, position: 'insideLeft', fill: css('--text-muted'), fontSize: 11 }}
          />
          <ReferenceArea y1={warning} y2={critical} fill={css('--status-warning-bg')} fillOpacity={0.75} ifOverflow="hidden" />
          <ReferenceArea
            y1={critical}
            y2={domain[1]}
            fill={css('--status-critical-bg')}
            fillOpacity={0.8}
            ifOverflow="hidden"
            label={{ value: 'Crítico', position: 'insideTopRight', fill: css('--status-critical-text'), fontSize: 10 }}
          />
          <ReferenceLine y={warning} stroke={css('--status-warning')} strokeDasharray="4 4" strokeWidth={1} label={{ value: 'Alerta', position: 'insideTopRight', fill: css('--status-warning-text'), fontSize: 10 }} />
          <ReferenceLine y={critical} stroke={css('--status-critical')} strokeDasharray="4 4" strokeWidth={1} />
          <Line dataKey="v" stroke={css('--brand-blue')} strokeWidth={2.25} dot={false} isAnimationActive={false} />
          <Tooltip
            isAnimationActive={false}
            labelFormatter={(timestamp) => formatDate(Number(timestamp))}
            formatter={(value: number) => [`${formatNumber(value, decimals)} ${unit}`, 'Valor']}
            contentStyle={{ fontSize: 13, borderColor: css('--line-subtle') }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

type AssetSortKey = 'asset' | 'type' | 'health' | 'usage' | 'maintenance' | 'status';
type SortDirection = 'asc' | 'desc';

const ASSET_DESCRIPTION: Record<string, string> = {
  M_100_01: 'Agitador',
  P_100_01: 'Bomba de transferência',
};

function describeAsset(asset: AssetHealth) {
  if (ASSET_DESCRIPTION[asset.id]) return ASSET_DESCRIPTION[asset.id];
  if (asset.id.startsWith('XV_')) {
    const valve = VALVES.find((item) => item.id === asset.id);
    return valve ? `Válvula · ${valve.function.toLowerCase()}` : 'Válvula';
  }
  const tag = TAGS[asset.id as TagId];
  return tag?.name ?? asset.name;
}

function canonicalPlanTag(asset: string) {
  const mapping: Record<string, string> = {
    'AIT 100-01': 'AIT_100_01',
    'XV-03': 'XV_100_03',
    'M-01': 'M_100_01',
    'P-01': 'P_100_01',
    'TIT · PIT · LIT': 'TIT_100_01 · PIT_100_01 · LIT_100_01',
  };
  return mapping[asset] ?? asset;
}

const RECOMMENDATION_TAGS = ['XV_100_03', 'XV_100_07', 'AIT_100_01', 'M_100_01'];

/** Manutenção preditiva: risco, séries de 30 dias, saúde dos ativos e plano. */
export function MaintenanceView({ now }: { now: number }) {
  const today = new Date(now);
  const probability = ML_INSIGHTS.failureProbability;
  const risk: BadgeStatus = probability >= ML_MODEL.critProbability ? 'critical' : probability >= ML_MODEL.warnProbability ? 'warning' : 'normal';
  const riskLabel = risk === 'critical' ? 'Risco alto' : risk === 'warning' ? 'Risco moderado' : 'Risco baixo';
  const probabilityData = probabilityHistory(today).map((point) => ({ ...point, v: point.v * 100 }));
  const vibrationData = vibrationHistory(today);
  const currentVibration = vibrationData[vibrationData.length - 1]?.v ?? 0;
  const probabilityTicks = [0, 20, 40, 60];
  const vibrationTicks = [0, 2, 4, 6];
  const vibrationWarning = VIBRATION_LIMIT_MM_S * 0.8;
  const tasksIn35Days = MAINTENANCE_PLAN.filter((task) => {
    const days = daysUntil(parseLocalDate(task.date), today);
    return days >= 0 && days <= 35;
  }).length;
  const [highlightedAsset, setHighlightedAsset] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: AssetSortKey; direction: SortDirection }>({ key: 'health', direction: 'asc' });

  const healthCounts = useMemo(() => ({
    good: ASSETS.filter((asset) => asset.health >= HEALTH_WARN).length,
    attention: ASSETS.filter((asset) => asset.health >= HEALTH_CRIT && asset.health < HEALTH_WARN).length,
    critical: ASSETS.filter((asset) => asset.health < HEALTH_CRIT).length,
  }), []);

  const sortedAssets = useMemo(() => [...ASSETS].sort((a, b) => {
    const value = (asset: AssetHealth): string | number => {
      switch (sort.key) {
        case 'asset': return `${asset.id} ${describeAsset(asset)}`;
        case 'type': return asset.type;
        case 'health': return asset.health;
        case 'usage': return asset.usage;
        case 'maintenance': return asset.lastMaintenance;
        case 'status': return asset.health < HEALTH_CRIT ? 2 : asset.health < HEALTH_WARN ? 1 : 0;
      }
    };
    const av = value(a);
    const bv = value(b);
    const compared = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'pt-BR');
    return compared * (sort.direction === 'asc' ? 1 : -1);
  }), [sort]);

  const toggleSort = (key: AssetSortKey) => setSort((previous) => ({
    key,
    direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc',
  }));

  const upcomingDueCount = tasksIn35Days;

  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,0.35fr)_minmax(0,0.65fr)] gap-3">
      <div className="grid min-h-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="Probabilidade de falha" subtitle={`próximos ${ML_INSIGHTS.horizonDays} dias`} className="min-h-0" bodyClassName="flex min-h-0 flex-col gap-2 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[36px] font-semibold leading-none text-ink num">{pct(probability)}</span>
            <StatusBadge status={risk} label={riskLabel} />
          </div>
          <div>
            <div className="relative h-3 rounded-sm border border-line bg-sunken" role="progressbar" aria-valuenow={Math.round(probability * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-sm bg-ink-default/80" style={{ width: `${probability * 100}%` }} />
              <span className="absolute -inset-y-1 w-0.5 bg-st-warning" style={{ left: `${ML_MODEL.warnProbability * 100}%` }} />
              <span className="absolute -inset-y-1 w-0.5 bg-st-critical" style={{ left: `${ML_MODEL.critProbability * 100}%` }} />
            </div>
            <div className="mt-0.5 flex justify-between text-[10px] leading-3 text-ink-muted num">
              <span>0 %</span><span>25 % · alerta</span><span>50 % · crítico</span><span>100 %</span>
            </div>
          </div>
          <ul className="flex min-h-0 flex-1 flex-col justify-around gap-1">
            {[...ML_INSIGHTS.factors].sort((a, b) => b.contribution - a.contribution).map((factor) => (
              <li key={factor.name} className="grid grid-cols-[minmax(0,1fr)_4.5rem_2.5rem] items-center gap-2 text-[13px]" title={factor.detail}>
                <span className="truncate text-ink" title={factor.detail}>{factor.name}</span>
                <span className="h-1.5 rounded-sm bg-sunken"><span className="block h-full rounded-sm bg-line-strong" style={{ width: `${factor.contribution * 100}%` }} /></span>
                <span className="text-right text-ink-muted num">{pct(factor.contribution, 0)}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line pt-1 text-[11px] leading-4 text-ink-muted num">
            {ML_MODEL.name} v{ML_MODEL.version} · treino {formatDate(parseLocalDate(ML_MODEL.trainedAt))} · confiança {pct(ML_MODEL.confidence, 0)} · valores ilustrativos
          </p>
        </Panel>

        <Panel
          title="Probabilidade · 30 dias"
          className="min-h-0"
          bodyClassName="flex min-h-0 flex-col p-3"
          actions={<span className="text-sm font-semibold text-ink num">{formatNumber(probabilityData[probabilityData.length - 1]?.v ?? 0, 1)} %</span>}
        >
          <DailyChart data={probabilityData} decimals={1} unit="%" domain={[0, 60]} ticks={probabilityTicks} warning={ML_MODEL.warnProbability * 100} critical={ML_MODEL.critProbability * 100} />
        </Panel>

        <Panel
          title="Vibração RMS · M-01"
          subtitle="últimos 30 dias"
          className="col-span-1 min-h-0 md:col-span-2 xl:col-span-1"
          bodyClassName="flex min-h-0 flex-col p-3"
          actions={<span className="text-sm font-semibold text-ink num">{formatNumber(currentVibration, 1)} mm/s</span>}
        >
          <DailyChart data={vibrationData} decimals={1} unit="mm/s" domain={[0, 6]} ticks={vibrationTicks} warning={vibrationWarning} critical={VIBRATION_LIMIT_MM_S} />
        </Panel>
      </div>

      <div className="grid min-h-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel
          title="Saúde dos ativos"
          subtitle={`índice 0–100 · atenção < ${HEALTH_WARN} · crítico < ${HEALTH_CRIT}`}
          className="min-h-0"
          bodyClassName="flex min-h-0 flex-col gap-1 px-3 py-2"
        >
          <p className="shrink-0 text-[13px] leading-5 text-ink-muted">
            {ASSETS.length} ativos · {healthCounts.good} bons · {healthCounts.attention} em atenção · {healthCounts.critical} críticos
          </p>
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-[25%]" /><col className="w-[9%]" /><col className="w-[21%]" /><col className="w-[16%]" /><col className="w-[16%]" /><col className="w-[13%]" />
            </colgroup>
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="h-6 border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-muted">
                <SortableHeader label="Ativo" column="asset" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Tipo" column="type" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Índice de saúde" column="health" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Uso" column="usage" sort={sort} onSort={toggleSort} alignRight />
                <SortableHeader label="Últ. manutenção" column="maintenance" sort={sort} onSort={toggleSort} />
                <SortableHeader label="Status" column="status" sort={sort} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sortedAssets.map((asset) => {
                const status: BadgeStatus = asset.health < HEALTH_CRIT ? 'critical' : asset.health < HEALTH_WARN ? 'warning' : 'normal';
                return (
                  <tr
                    key={asset.id}
                    id={`asset-${asset.id}`}
                    className={cn('h-[26px] border-b border-line/70 text-[13px]', highlightedAsset === asset.id && 'bg-brand-soft')}
                  >
                    <td className="truncate pr-1">
                      <span className="font-mono font-medium text-ink">{asset.id}</span><span className="text-ink-muted"> · {describeAsset(asset)}</span>
                    </td>
                    <td className="truncate text-ink-default">{asset.type}</td>
                    <td className="pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-full max-w-40 rounded-sm bg-sunken"><span className={cn('block h-full rounded-sm', status === 'critical' ? 'bg-st-critical' : status === 'warning' ? 'bg-st-warning' : 'bg-ink-default/70')} style={{ width: `${asset.health}%` }} /></span>
                        <span className="w-7 shrink-0 text-right font-medium text-ink num">{asset.health}</span>
                      </div>
                    </td>
                    <td className="truncate border-r border-line/50 pr-2 text-right text-ink-default num">{asset.usage}</td>
                    <td className="truncate pl-2 text-ink-default num">{formatDate(parseLocalDate(asset.lastMaintenance))}</td>
                    <td>
                      {status === 'normal'
                        ? <span className="inline-flex items-center gap-1 text-[13px] text-ink-muted"><CircleCheck className="size-3.5" aria-hidden />Bom</span>
                        : <StatusBadge status={status} label={status === 'critical' ? 'Crítico' : 'Atenção'} className="py-0.5" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>

        <Panel
          title="Plano de manutenção"
          className="min-h-0"
          bodyClassName="flex min-h-0 flex-col gap-2 px-3 py-3"
          actions={<span className="text-sm text-ink-muted num">{upcomingDueCount} tarefas nos próximos 35 dias</span>}
        >
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup><col className="w-[11%]" /><col className="w-[23%]" /><col className="w-[20%]" /><col className="w-[25%]" /><col className="w-[21%]" /></colgroup>
            <thead>
              <tr className="h-6 border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-muted">
                <th className="font-semibold">Data</th><th className="font-semibold">Ativo</th><th className="font-semibold">Tipo</th><th className="font-semibold">Responsável</th><th className="font-semibold">Prazo</th>
              </tr>
            </thead>
            <tbody>
              {MAINTENANCE_PLAN.slice(0, 5).map((task) => {
                const due = dueStatus(task.date, today);
                return (
                  <tr key={`${task.date}${task.asset}`} className="h-7 border-b border-line/70" title={task.description}>
                    <td className="text-[13px] text-ink num">{formatDate(parseLocalDate(task.date)).slice(0, 5)}</td>
                    <td className="truncate pr-1 font-mono text-[11px] text-ink" title={canonicalPlanTag(task.asset)}>{canonicalPlanTag(task.asset)}</td>
                    <td><TaskTypeBadge type={task.type} /></td>
                    <td className="truncate pr-1 text-[13px] text-ink-default">{task.owner}</td>
                    <td><DueLabel kind={due.kind}>{due.label}</DueLabel></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="min-h-0 border-t border-line pt-2">
            <h3 className="mb-1 text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Recomendações do modelo</h3>
            <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-4 text-ink">
              {ML_INSIGHTS.recommendations.map((recommendation, index) => {
                const tag = RECOMMENDATION_TAGS[index];
                return <li key={recommendation}>
                  <button
                    type="button"
                    className="mr-1 font-mono font-medium text-brand underline decoration-brand/40 underline-offset-2 hover:text-brand-strong"
                    onClick={() => setHighlightedAsset(tag)}
                    aria-pressed={highlightedAsset === tag}
                    title={`Destacar ${tag} na tabela de saúde`}
                  >{tag}</button>
                  <span>{recommendation}</span>
                </li>;
              })}
            </ol>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  sort,
  onSort,
  alignRight = false,
}: {
  label: string;
  column: AssetSortKey;
  sort: { key: AssetSortKey; direction: SortDirection };
  onSort: (key: AssetSortKey) => void;
  alignRight?: boolean;
}) {
  const Icon = sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return <th aria-sort={sort.key === column ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
    <button type="button" className={cn('flex w-full items-center gap-1 px-1 py-1 font-semibold hover:text-ink', alignRight && 'justify-end')} onClick={() => onSort(column)}>
      {label}{sort.key === column && <Icon className="size-3 shrink-0" aria-hidden />}
    </button>
  </th>;
}
