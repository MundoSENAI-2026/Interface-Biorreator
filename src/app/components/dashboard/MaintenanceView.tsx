import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { MAINTENANCE, ML_MODEL } from '../../config/plant';
import {
  ASSETS,
  HEALTH_CRIT,
  HEALTH_WARN,
  MAINTENANCE_PLAN,
  ML_INSIGHTS,
  VIBRATION_LIMIT_MM_S,
  probabilityHistory,
  vibrationHistory,
  type DailyPoint,
  type TaskType,
} from '../../data/mlInsights';
import { simulation } from '../../data/source';
import { daysUntil, formatDate, formatNumber, parseLocalDate, pluralize } from '../../lib/format';
import { Panel } from '../hmi/Panel';
import { StatusBadge, type BadgeStatus } from '../hmi/StatusBadge';
import { cn } from '../ui/utils';

const css = (v: string) => `var(${v})`;
const AXIS = { fontSize: 13, fill: css('--text-muted') };
const pct = (x: number, d = 1) => `${formatNumber(x * 100, d)} %`;
const shortDate = (t: number) => formatDate(t).slice(0, 5);

/** Status de um prazo: "Em X dias" (verde) ou "Atrasada há X dias" (âmbar). */
export function dueStatus(iso: string, today: Date): { badge: BadgeStatus; label: string } {
  const days = daysUntil(parseLocalDate(iso), today);
  if (days < 0) return { badge: 'warning', label: `Atrasada há ${pluralize(-days, 'dia', 'dias')}` };
  if (days === 0) return { badge: 'warning', label: 'Vence hoje' };
  return { badge: 'good', label: `Em ${pluralize(days, 'dia', 'dias')}` };
}

function DailyChart({ data, decimals, unit, refs, domain }: {
  data: DailyPoint[];
  decimals: number;
  unit: string;
  refs: { y: number; color: string; label: string }[];
  domain: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={css('--line-subtle')} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="t" type="number" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tick={AXIS} tickLine={false} axisLine={{ stroke: css('--line-strong') }} tickCount={5} />
        <YAxis domain={domain} tick={AXIS} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatNumber(v, decimals === 0 ? 0 : 1)} />
        {refs.map((r) => (
          <ReferenceLine key={r.label} y={r.y} stroke={css(r.color)} strokeDasharray="6 4" strokeWidth={1.5}
            label={{ value: r.label, position: 'insideTopRight', fontSize: 13, fill: css('--text-muted') }} />
        ))}
        <Line dataKey="v" stroke={css('--brand-blue')} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        <Tooltip
          isAnimationActive={false}
          labelFormatter={(t) => formatDate(Number(t))}
          formatter={(v: number) => [`${formatNumber(v, decimals)} ${unit}`.trim(), 'Valor']}
          contentStyle={{ fontSize: 14, borderColor: css('--line-subtle') }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

const TASK_STYLE: Record<TaskType, BadgeStatus> = { Preventiva: 'neutral', Preditiva: 'info', Calibração: 'stopped' };

/** Tela de manutenção: risco do modelo, tendências de 30 dias, saúde dos ativos e plano. */
export function MaintenanceView({ now }: { now: number }) {
  const today = new Date(now);
  const p = ML_INSIGHTS.failureProbability;
  const risk: BadgeStatus = p >= ML_MODEL.critProbability ? 'critical' : p >= ML_MODEL.warnProbability ? 'warning' : 'normal';
  const riskLabel = risk === 'critical' ? 'Risco alto' : risk === 'warning' ? 'Risco moderado' : 'Risco baixo';
  const next = dueStatus(MAINTENANCE.nextDate, today);
  const vib = vibrationHistory(today);

  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[minmax(16rem,0.6fr)_minmax(0,1fr)] gap-3">
      {/* Linha 1 */}
      <Panel title="Probabilidade de falha" subtitle={`próximos ${ML_INSIGHTS.horizonDays} dias`} className="col-span-12 min-h-0 xl:col-span-4" bodyClassName="flex min-h-0 flex-col gap-2 py-3"
        actions={<StatusBadge status={risk} label={riskLabel} />}>
        <div className="flex items-baseline gap-3">
          <span className="text-[40px] font-semibold leading-none text-ink num">{pct(p)}</span>
          <div className="relative h-2.5 flex-1 rounded-sm border border-line bg-sunken">
            <div className="h-full bg-ink-default" style={{ width: `${p * 100}%` }} />
            <div className="absolute -inset-y-1 w-0.5 bg-st-warning" style={{ left: `${ML_MODEL.warnProbability * 100}%` }} title="Alerta" />
            <div className="absolute -inset-y-1 w-0.5 bg-st-critical" style={{ left: `${ML_MODEL.critProbability * 100}%` }} title="Crítico" />
          </div>
        </div>
        <ul className="flex flex-1 flex-col justify-around">
          {[...ML_INSIGHTS.factors].sort((a, b) => b.contribution - a.contribution).map((f) => (
            <li key={f.name} className="grid grid-cols-[1fr_auto] items-baseline gap-x-2 text-[15px]" title={f.detail}>
              <span className="truncate text-ink">{f.name}</span>
              <span className="text-ink-muted num">{pct(f.contribution, 0)}</span>
              <span className="col-span-2 h-1.5 rounded-sm bg-sunken">
                <span className="block h-full rounded-sm bg-line-strong" style={{ width: `${f.contribution * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
        <p className="border-t border-line pt-1.5 text-[13px] text-ink-muted num">
          {ML_MODEL.name} v{ML_MODEL.version} · treinado em {formatDate(parseLocalDate(ML_MODEL.trainedAt))} · confiança {pct(ML_MODEL.confidence, 0)}
          {simulation && ' · valores ilustrativos (modo demonstração)'}
        </p>
      </Panel>

      <Panel title="Probabilidade de falha – últimos 30 dias" className="col-span-12 min-h-0 md:col-span-6 xl:col-span-4" bodyClassName="min-h-0 p-2">
        <DailyChart
          data={probabilityHistory(today).map((d) => ({ t: d.t, v: d.v * 100 }))}
          decimals={1}
          unit="%"
          domain={[0, 60]}
          refs={[
            { y: ML_MODEL.critProbability * 100, color: '--status-critical', label: `Crítico ${pct(ML_MODEL.critProbability, 0)}` },
            { y: ML_MODEL.warnProbability * 100, color: '--status-warning', label: `Alerta ${pct(ML_MODEL.warnProbability, 0)}` },
          ]}
        />
      </Panel>

      <Panel title="Vibração RMS do motor M-01 – últimos 30 dias" subtitle="mm/s" className="col-span-12 min-h-0 md:col-span-6 xl:col-span-4" bodyClassName="min-h-0 p-2">
        <DailyChart
          data={vib}
          decimals={2}
          unit="mm/s"
          domain={[0, 6]}
          refs={[{ y: VIBRATION_LIMIT_MM_S, color: '--status-critical', label: `Limite ${formatNumber(VIBRATION_LIMIT_MM_S, 1)} mm/s` }]}
        />
      </Panel>

      {/* Linha 2 */}
      <Panel title="Saúde dos ativos" subtitle={`Índice 0–100 · atenção < ${HEALTH_WARN} · crítico < ${HEALTH_CRIT}`} className="col-span-12 min-h-0 xl:col-span-7" bodyClassName="min-h-0 px-3 py-1">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-40" />
            <col className="w-20" />
            <col />
            <col className="w-44" />
            <col className="w-32" />
            <col className="w-28" />
          </colgroup>
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-wide text-ink-muted">
              <th className="py-1 font-semibold">Ativo</th>
              <th className="py-1 font-semibold">Tipo</th>
              <th className="py-1 font-semibold">Índice de saúde</th>
              <th className="py-1 font-semibold">Uso</th>
              <th className="py-1 font-semibold">Últ. manutenção</th>
              <th className="py-1 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {ASSETS.map((a) => {
              const status: BadgeStatus = a.health < HEALTH_CRIT ? 'critical' : a.health < HEALTH_WARN ? 'warning' : 'normal';
              return (
                <tr key={a.id} className="border-t border-line">
                  <td className="truncate py-px font-mono text-[13px] font-medium text-ink">{a.name}</td>
                  <td className="py-px text-ink-default">{a.type}</td>
                  <td className="py-px pr-4">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 flex-1 rounded-sm bg-sunken">
                        <span
                          className={cn('block h-full rounded-sm', status === 'critical' ? 'bg-st-critical' : status === 'warning' ? 'bg-st-warning' : 'bg-ink-default/70')}
                          style={{ width: `${a.health}%` }}
                        />
                      </span>
                      <span className="w-7 text-right font-medium text-ink num">{a.health}</span>
                    </div>
                  </td>
                  <td className="truncate py-px text-ink-default num">{a.usage}</td>
                  <td className="py-px text-ink-default num">{formatDate(parseLocalDate(a.lastMaintenance))}</td>
                  <td className="py-px">
                    <StatusBadge status={status} label={status === 'critical' ? 'Crítico' : status === 'warning' ? 'Atenção' : 'Bom'} className="py-0.5" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <Panel title="Plano de manutenção" className="col-span-12 min-h-0 xl:col-span-5" bodyClassName="flex min-h-0 flex-col gap-3 py-3"
        actions={
          <span className="flex items-center gap-2 text-sm text-ink-muted num">
            Próxima preventiva {formatDate(parseLocalDate(MAINTENANCE.nextDate))}
            <StatusBadge status={next.badge} label={next.label} />
          </span>
        }>
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-16" />
            <col className="w-32" />
            <col className="w-32" />
            <col />
            <col className="w-32" />
          </colgroup>
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-wide text-ink-muted">
              <th className="pb-1 font-semibold">Data</th>
              <th className="pb-1 font-semibold">Ativo</th>
              <th className="pb-1 font-semibold">Tipo</th>
              <th className="pb-1 font-semibold">Responsável</th>
              <th className="pb-1 font-semibold">Prazo</th>
            </tr>
          </thead>
          <tbody>
            {MAINTENANCE_PLAN.slice(0, 5).map((t) => {
              const due = dueStatus(t.date, today);
              return (
                <tr key={`${t.date}${t.asset}`} className="border-t border-line" title={t.description}>
                  <td className={cn('py-2 num', due.badge === 'warning' ? 'font-semibold text-st-warning-text' : 'text-ink')}>{formatDate(parseLocalDate(t.date)).slice(0, 5)}</td>
                  <td className="truncate py-2 font-mono text-[13px] text-ink">{t.asset}</td>
                  <td className="py-2"><StatusBadge status={TASK_STYLE[t.type]} label={t.type} /></td>
                  <td className="truncate py-2 text-ink-default">{t.owner}</td>
                  <td className="py-2"><StatusBadge status={due.badge} label={due.label} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="min-h-0 border-t border-line pt-2">
          <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-ink-muted">Recomendações do modelo</h3>
          <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-snug text-ink">
            {ML_INSIGHTS.recommendations.map((r) => <li key={r}>{r}</li>)}
          </ol>
        </div>
      </Panel>
    </div>
  );
}
