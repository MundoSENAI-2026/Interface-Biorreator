import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ALARM_RATE_TARGET_PER_10MIN, LEVEL_LABEL, LEVELS, type AlarmStats } from '../../data/alarmStats';
import { formatDuration, formatNumber, formatTime } from '../../lib/format';
import { Panel } from '../hmi/Panel';
import { cn } from '../ui/utils';

const css = (v: string) => `var(${v})`;

const LEVEL_BAR: Record<string, string> = {
  critica: 'bg-st-critical',
  alta: 'bg-st-warning',
  media: 'bg-st-warning/55',
  baixa: 'bg-st-normal',
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface px-3 py-2">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="text-2xl font-semibold text-ink num">{value}</dd>
      {hint && <dd className="text-[13px] text-ink-muted">{hint}</dd>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

/** Indicadores de desempenho do sistema de alarmes (ISA-18.2). */
export function AlarmIndicators({ stats }: { stats: AlarmStats }) {
  const maxLevel = Math.max(1, ...LEVELS.map((l) => stats.byLevel[l]));
  const rateData = stats.rate.map((b) => ({ label: formatTime(b.start).slice(0, 5), count: b.count }));
  const yMax = Math.max(2, ...rateData.map((d) => d.count));
  const overTarget = rateData.filter((d) => d.count > ALARM_RATE_TARGET_PER_10MIN).length;

  return (
    <Panel title="Indicadores de alarmes (ISA-18.2)" className="min-h-0" bodyClassName="flex min-h-0 flex-col gap-3 py-3">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line">
        <Kpi label="Alarmes no lote" value={String(stats.totalLot)} />
        <Kpi label="Últimas 24 h" value={String(stats.total24h)} />
        <Kpi label="Tempo médio p/ reconhecer" value={stats.meanAckS === null ? '—' : formatDuration(stats.meanAckS)} />
      </dl>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-4">
        <section className="flex min-h-0 flex-col">
          <SectionTitle>Por prioridade (lote)</SectionTitle>
          <ul className="flex flex-1 flex-col justify-center gap-5">
            {LEVELS.map((l) => (
              <li key={l} className="grid grid-cols-[4rem_1fr_2rem] items-center gap-2 text-[15px]">
                <span className="text-ink-default">{LEVEL_LABEL[l]}</span>
                <span className="h-6 rounded-sm bg-sunken">
                  <span className={cn('block h-full rounded-sm', LEVEL_BAR[l])} style={{ width: `${(stats.byLevel[l] / maxLevel) * 100}%` }} />
                </span>
                <span className="text-right font-medium text-ink num">{stats.byLevel[l]}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex min-h-0 flex-col">
          <SectionTitle>Alarmes por 10 min</SectionTitle>
          <div className="min-h-28 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rateData} margin={{ top: 6, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid stroke={css('--line-subtle')} strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: css('--text-muted') }} tickLine={false} axisLine={{ stroke: css('--line-strong') }} interval={1} />
                <YAxis domain={[0, yMax]} allowDecimals={false} tick={{ fontSize: 13, fill: css('--text-muted') }} tickLine={false} axisLine={false} />
                <ReferenceLine y={ALARM_RATE_TARGET_PER_10MIN} stroke={css('--status-info')} strokeDasharray="5 3" strokeWidth={1.5} />
                <Tooltip
                  cursor={{ fill: css('--surface-sunken') }}
                  isAnimationActive={false}
                  formatter={(v: number) => [`${v} alarme(s)`, 'Janela de 10 min']}
                  labelFormatter={(l) => `A partir de ${l}`}
                  contentStyle={{ fontSize: 14, borderColor: css('--line-subtle') }}
                />
                <Bar dataKey="count" isAnimationActive={false} radius={[3, 3, 0, 0]}>
                  {rateData.map((d, i) => (
                    <Cell key={i} fill={d.count > ALARM_RATE_TARGET_PER_10MIN ? css('--status-warning') : css('--text-default')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[13px] text-ink-muted">
            <span className="mr-1 inline-block w-4 border-t-2 border-dashed border-st-info align-middle" /> Meta ≤ {ALARM_RATE_TARGET_PER_10MIN} por 10 min ·{' '}
            {overTarget === 0 ? 'dentro da meta na última hora' : `${overTarget} janela(s) acima da meta`}
          </p>
        </section>
      </div>

      <section className="min-h-0">
        <SectionTitle>Top 5 alarmes mais frequentes (lote)</SectionTitle>
        {stats.top.length === 0 ? (
          <p className="text-[15px] text-ink-muted">Nenhum alarme registrado neste lote.</p>
        ) : (
          <table className="w-full table-fixed text-[15px]">
            <colgroup>
              <col className="w-32" />
              <col />
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className="text-left text-[13px] uppercase tracking-wide text-ink-muted">
                <th className="pb-1 font-semibold">Tag</th>
                <th className="pb-1 font-semibold">Mensagem</th>
                <th className="pb-1 text-right font-semibold">Ocorrências</th>
              </tr>
            </thead>
            <tbody>
              {stats.top.map((t) => (
                <tr key={`${t.source}${t.message}`} className="border-t border-line">
                  <td className="py-1 pr-3 font-mono text-[13px] text-ink-default">{t.source}</td>
                  <td className="max-w-0 truncate py-1 text-ink" title={t.message}>{t.message}</td>
                  <td className="py-1 text-right font-medium text-ink num">{formatNumber(t.count, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </Panel>
  );
}
