import { Activity, Bell, Check, Download, Search, UserRound, type LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PLANT } from '../../config/plant';
import type { Alarm, AlarmPriority, AlarmState, EventCategory, PlantEvent } from '../../data/types';
import { formatDate, formatTime } from '../../lib/format';
import { cn } from '../ui/utils';
import { StatusBadge } from './StatusBadge';

const STATE_LABEL: Record<AlarmState, string> = {
  active: 'Ativo',
  acknowledged: 'Reconhecido',
  normalized: 'Normalizado',
};

const STATE_ORDER: Record<AlarmState, number> = { active: 0, normalized: 1, acknowledged: 2 };

const PRIORITY_LABEL: Record<AlarmPriority, string> = { critical: 'Crítico', warning: 'Alerta' };

export const CATEGORY: Record<EventCategory, { label: string; icon: LucideIcon }> = {
  alarm: { label: 'Alarme', icon: Bell },
  process: { label: 'Evento de processo', icon: Activity },
  operator: { label: 'Ação do operador', icon: UserRound },
};

/** Ordenação ISA-18.2: prioridade, depois não reconhecidos, depois mais recentes. */
export function sortAlarms(alarms: Alarm[]) {
  return [...alarms].sort(
    (a, b) =>
      (a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1) ||
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.activatedAt - a.activatedAt,
  );
}

const th = 'sticky top-0 bg-sunken px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted';
const td = 'px-3 py-2 align-top';

/** Alarmes ativos (ativo, reconhecido, normalizado não reconhecido). */
export function ActiveTable({ alarms, onAcknowledge }: { alarms: Alarm[]; onAcknowledge: (id: string) => void }) {
  const sorted = useMemo(() => sortAlarms(alarms), [alarms]);
  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded border border-dashed border-line py-8 text-[15px] text-ink-muted">
        Nenhum alarme ativo
      </div>
    );
  }
  return (
    <div className="min-h-0 flex-1 overflow-auto rounded border border-line">
      <table className="w-full border-collapse text-[15px]">
        <thead>
          <tr>
            <th className={th}>Prioridade</th>
            <th className={th}>Hora</th>
            <th className={th}>Tag · mensagem</th>
            <th className={th}>Estado</th>
            <th className={cn(th, 'text-right')}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => (
            <tr
              key={a.id}
              className={cn(
                'border-t border-line transition-colors duration-200',
                a.state === 'active' && (a.priority === 'critical' ? 'bg-st-critical-bg' : 'bg-st-warning-bg'),
              )}
            >
              <td className={td}><StatusBadge status={a.priority} /></td>
              <td className={cn(td, 'text-ink-default num')}>{formatTime(a.activatedAt)}</td>
              <td className={td}>
                <div className="font-mono text-[13px] text-ink-muted">{a.source}</div>
                <div className={a.state === 'normalized' ? 'text-ink-muted' : 'text-ink'}>{a.message}</div>
              </td>
              <td className={cn(td, 'whitespace-nowrap', a.state === 'active' ? 'font-semibold text-ink' : 'text-ink-muted')}>
                {STATE_LABEL[a.state]}
              </td>
              <td className={cn(td, 'text-right')}>
                {a.state !== 'acknowledged' && (
                  <button
                    onClick={() => onAcknowledge(a.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-sunken"
                  >
                    <Check className="size-4" aria-hidden />
                    Reconhecer
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Histórico ─────────────────────────────────────────────────────────────

const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV com ";" e BOM UTF-8 — abre direto no Excel em português. */
function exportCsv(events: PlantEvent[]) {
  const header = ['Data', 'Hora', 'Tipo', 'Prioridade', 'Origem', 'Ação', 'Mensagem', 'Usuário'];
  const lines = events.map((e) =>
    [
      formatDate(e.time),
      formatTime(e.time),
      CATEGORY[e.category].label,
      e.priority ? PRIORITY_LABEL[e.priority] : '',
      e.source,
      e.action,
      e.message,
      e.user ?? '',
    ].map(csvCell).join(';'),
  );
  const blob = new Blob(['﻿' + [header.join(';'), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${PLANT.equipmentId}-eventos-${stamp}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Histórico filtrável de todos os eventos (alarmes, processo e operador), com exportação CSV. */
export function HistoryTable({ events }: { events: PlantEvent[] }) {
  const [category, setCategory] = useState<'all' | EventCategory>('all');
  const [priority, setPriority] = useState<'all' | AlarmPriority>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (priority === 'all' || e.priority === priority) &&
        (!q || [e.source, e.message, e.action, e.user ?? ''].some((f) => f.toLowerCase().includes(q))),
    );
  }, [events, category, priority, query]);

  const select = 'h-9 rounded border border-line-strong bg-surface px-2 text-sm text-ink';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="hist-category">Tipo</label>
        <select id="hist-category" className={select} value={category} onChange={(e) => setCategory(e.target.value as typeof category)}>
          <option value="all">Todos os tipos</option>
          {(Object.keys(CATEGORY) as EventCategory[]).map((c) => (
            <option key={c} value={c}>{CATEGORY[c].label}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="hist-priority">Prioridade</label>
        <select id="hist-priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="all">Todas as prioridades</option>
          <option value="critical">Crítico</option>
          <option value="warning">Alerta</option>
        </select>
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por tag, mensagem ou usuário"
            className="h-9 w-full rounded border border-line-strong bg-surface pl-8 pr-2 text-sm text-ink placeholder:text-ink-muted"
          />
        </div>
        <span className="text-sm text-ink-muted num">{filtered.length} de {events.length}</span>
        <button
          onClick={() => exportCsv(filtered)}
          disabled={filtered.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled"
        >
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded border border-line">
        <table className="w-full border-collapse text-[15px]">
          <thead>
            <tr>
              <th className={th}>Hora</th>
              <th className={th}>Tipo</th>
              <th className={th}>Origem</th>
              <th className={th}>Ação</th>
              <th className={th}>Mensagem</th>
              <th className={th}>Usuário</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">Nenhum evento para os filtros escolhidos</td>
              </tr>
            ) : (
              filtered.map((e) => {
                const Icon = CATEGORY[e.category].icon;
                return (
                  <tr key={e.seq} className="border-t border-line">
                    <td className={cn(td, 'whitespace-nowrap text-ink-default num')}>{formatTime(e.time)}</td>
                    <td className={cn(td, 'whitespace-nowrap')}>
                      {e.priority ? (
                        <StatusBadge status={e.priority} icon={Icon} label={`Alarme · ${PRIORITY_LABEL[e.priority]}`} />
                      ) : (
                        <StatusBadge status={e.category === 'operator' ? 'info' : 'neutral'} icon={Icon} label={CATEGORY[e.category].label} />
                      )}
                    </td>
                    <td className={cn(td, 'font-mono text-[13px] text-ink-default')}>{e.source}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-default')}>{e.action}</td>
                    <td className={cn(td, 'text-ink')}>{e.message}</td>
                    <td className={cn(td, 'whitespace-nowrap text-ink-default')}>{e.user ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
