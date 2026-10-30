import { Wrench } from 'lucide-react';
import { MAINTENANCE, ML_MODEL } from '../../config/plant';
import { ML_INSIGHTS } from '../../data/mlInsights';
import { simulation } from '../../data/source';
import { daysUntil, formatDate, formatDateLong, formatNumber, parseLocalDate, pluralize } from '../../lib/format';
import { StatusBadge, type BadgeStatus } from '../hmi/StatusBadge';

function maintenanceStatus(today: Date): { badge: BadgeStatus; label: string } {
  const days = daysUntil(parseLocalDate(MAINTENANCE.nextDate), today);
  if (days < 0) return { badge: 'warning', label: `Atrasada há ${pluralize(-days, 'dia', 'dias')}` };
  if (days === 0) return { badge: 'warning', label: 'Vence hoje' };
  if (days <= MAINTENANCE.warnDaysBefore) return { badge: 'info', label: `Em ${pluralize(days, 'dia', 'dias')}` };
  return { badge: 'normal', label: `Em ${pluralize(days, 'dia', 'dias')}` };
}

const pct = (x: number, d = 1) => `${formatNumber(x * 100, d)} %`;

/** Painel de Machine Learning: risco com fatores explicados, recomendações e dados do modelo. */
export function MlPanel({ now }: { now: number }) {
  const { failureProbability: p, factors, recommendations, horizonDays } = ML_INSIGHTS;
  const risk: BadgeStatus = p >= ML_MODEL.critProbability ? 'critical' : p >= ML_MODEL.warnProbability ? 'warning' : 'normal';
  const riskLabel = risk === 'critical' ? 'Risco alto' : risk === 'warning' ? 'Risco moderado' : 'Risco baixo';
  const maint = maintenanceStatus(new Date(now));
  const sortedFactors = [...factors].sort((a, b) => b.contribution - a.contribution);

  return (
    <div className="grid gap-5 min-[1800px]:grid-cols-2">
      {/* Probabilidade + fatores */}
      <section className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Probabilidade de falha · próximos {horizonDays} dias
            </h3>
            <p className="text-3xl font-semibold text-ink num">{pct(p)}</p>
          </div>
          <StatusBadge status={risk} label={riskLabel} />
        </div>
        <div className="relative h-2.5 rounded-sm border border-line bg-sunken">
          <div className="h-full bg-ink-default" style={{ width: `${p * 100}%` }} />
          {[ML_MODEL.warnProbability, ML_MODEL.critProbability].map((t, i) => (
            <div
              key={t}
              className={i ? 'absolute -inset-y-1 w-0.5 bg-st-critical' : 'absolute -inset-y-1 w-0.5 bg-st-warning'}
              style={{ left: `${t * 100}%` }}
              title={`${i ? 'Crítico' : 'Alerta'} a partir de ${pct(t, 0)}`}
            />
          ))}
        </div>
        <p className="text-xs text-ink-muted num">
          Limiares: alerta a partir de {pct(ML_MODEL.warnProbability, 0)}, crítico a partir de {pct(ML_MODEL.critProbability, 0)}.
        </p>

        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-ink-default">Fatores que mais contribuem para o risco</h4>
          <ul className="flex flex-col gap-2">
            {sortedFactors.map((f) => (
              <li key={f.name} className="text-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-ink">{f.name}</span>
                  <span className="shrink-0 text-ink-muted num">{pct(f.contribution, 0)}</span>
                </div>
                <div className="my-1 h-1.5 rounded-sm bg-sunken">
                  <div className="h-full rounded-sm bg-line-strong" style={{ width: `${f.contribution * 100}%` }} />
                </div>
                <p className="text-xs text-ink-muted">{f.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Recomendações, manutenção, modelo */}
      <section className="flex flex-col gap-4">
        <div>
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Recomendações</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-snug text-ink">
            {recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ol>
        </div>

        <div className="rounded border border-line p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <Wrench className="mt-0.5 size-4 text-ink-muted" aria-hidden />
              <div>
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Próxima manutenção</h3>
                <p className="text-sm font-medium text-ink">{formatDateLong(parseLocalDate(MAINTENANCE.nextDate))}</p>
                <p className="text-xs text-ink-muted">{MAINTENANCE.description}</p>
              </div>
            </div>
            <StatusBadge status={maint.badge} label={maint.label} />
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded border border-line bg-line text-xs">
          {[
            ['Modelo', `${ML_MODEL.name} v${ML_MODEL.version}`],
            ['Treinado em', formatDate(parseLocalDate(ML_MODEL.trainedAt))],
            ['Confiança', pct(ML_MODEL.confidence, 0)],
          ].map(([k, v]) => (
            <div key={k} className="bg-surface px-2.5 py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="font-medium text-ink num">{v}</dd>
            </div>
          ))}
        </dl>
        {simulation && <p className="text-xs text-ink-muted">Valores do modelo ilustrativos (modo simulação).</p>}
      </section>
    </div>
  );
}
