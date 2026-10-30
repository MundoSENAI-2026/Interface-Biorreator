import { Check, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Alarm, AlarmEvent, AlarmState, EventType } from '../../data/types';
import { formatTime } from '../../lib/format';
import { cn } from '../ui/utils';
import { StatusBadge } from './StatusBadge';

interface AlarmListProps {
  alarms: Alarm[];
  events: AlarmEvent[];
  onAcknowledge: (id: string) => void;
  onAcknowledgeAll: () => void;
}

const STATE_LABEL: Record<AlarmState, string> = {
  active: 'Ativo',
  acknowledged: 'Reconhecido',
  normalized: 'Normalizado',
};

const PRIORITY_LABEL = { critical: 'Crítico', warning: 'Alerta', info: 'Informação' } as const;

const STATE_ORDER: Record<AlarmState, number> = { active: 0, normalized: 1, acknowledged: 2 };

/** Ordenação ISA-18.2: prioridade, depois não reconhecidos, depois mais recentes. */
function sortAlarms(alarms: Alarm[]) {
  return [...alarms].sort(
    (a, b) =>
      (a.priority === b.priority ? 0 : a.priority === 'critical' ? -1 : 1) ||
      STATE_ORDER[a.state] - STATE_ORDER[b.state] ||
      b.activatedAt - a.activatedAt,
  );
}

const th = 'px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted';
const td = 'px-2 py-1.5 align-top';

export function AlarmList({ alarms, events, onAcknowledge, onAcknowledgeAll }: AlarmListProps) {
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const sorted = useMemo(() => sortAlarms(alarms), [alarms]);
  const unacked = alarms.filter((a) => a.state !== 'acknowledged').length;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div role="tablist" className="inline-flex rounded border border-line bg-sunken p-0.5 text-sm">
          {(
            [
              ['active', `Ativos (${alarms.length})`],
              ['history', 'Histórico'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn('rounded px-3 py-1', tab === id ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === 'active' && (
          <button
            onClick={onAcknowledgeAll}
            disabled={unacked === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled disabled:hover:bg-surface"
          >
            <Check className="size-4" aria-hidden />
            Reconhecer todos ({unacked})
          </button>
        )}
      </div>

      {tab === 'active' ? (
        <ActiveTable alarms={sorted} onAcknowledge={onAcknowledge} />
      ) : (
        <HistoryTable events={events} />
      )}
    </div>
  );
}

function ActiveTable({ alarms, onAcknowledge }: { alarms: Alarm[]; onAcknowledge: (id: string) => void }) {
  if (alarms.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center rounded border border-dashed border-line py-8 text-sm text-ink-muted">
        Nenhum alarme ativo
      </div>
    );
  }
  return (
    <div className="max-h-[22rem] flex-1 overflow-auto rounded border border-line">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 bg-sunken">
          <tr>
            <th className={th}>Prioridade</th>
            <th className={th}>Hora</th>
            <th className={th}>Tag</th>
            <th className={th}>Mensagem</th>
            <th className={th}>Estado</th>
            <th className={cn(th, 'text-right')}>Ação</th>
          </tr>
        </thead>
        <tbody>
          {alarms.map((a) => {
            const muted = a.state === 'normalized';
            return (
              <tr
                key={a.id}
                className={cn(
                  'border-t border-line',
                  a.state === 'active' && a.priority === 'critical' && 'bg-st-critical-bg',
                  a.state === 'active' && a.priority === 'warning' && 'bg-st-warning-bg',
                )}
              >
                <td className={td}>
                  <StatusBadge status={a.priority} />
                </td>
                <td className={cn(td, 'num text-ink-default')}>{formatTime(a.activatedAt)}</td>
                <td className={cn(td, 'font-mono text-xs text-ink-default')}>{a.source}</td>
                <td className={cn(td, muted ? 'text-ink-muted' : 'text-ink')}>{a.message}</td>
                <td className={cn(td, 'whitespace-nowrap', a.state === 'active' ? 'font-semibold text-ink' : 'text-ink-muted')}>
                  {STATE_LABEL[a.state]}
                </td>
                <td className={cn(td, 'text-right')}>
                  {a.state !== 'acknowledged' && (
                    <button
                      onClick={() => onAcknowledge(a.id)}
                      className="inline-flex h-7 items-center gap-1 rounded border border-line-strong bg-surface px-2 text-xs text-ink hover:bg-sunken"
                    >
                      <Check className="size-3.5" aria-hidden />
                      Reconhecer
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const EVENT_TYPES: EventType[] = ['Ativado', 'Reconhecido', 'Normalizado', 'Comando', 'Bloqueado'];

function HistoryTable({ events }: { events: AlarmEvent[] }) {
  const [priority, setPriority] = useState<'all' | AlarmEvent['priority']>('all');
  const [type, setType] = useState<'all' | EventType>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (priority === 'all' || e.priority === priority) &&
        (type === 'all' || e.type === type) &&
        (!q || e.source.toLowerCase().includes(q) || e.message.toLowerCase().includes(q)),
    );
  }, [events, priority, type, query]);

  const select = 'h-8 rounded border border-line-strong bg-surface px-2 text-sm text-ink';

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="hist-priority">Prioridade</label>
        <select id="hist-priority" className={select} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
          <option value="all">Todas as prioridades</option>
          <option value="critical">Crítico</option>
          <option value="warning">Alerta</option>
          <option value="info">Informação</option>
        </select>
        <label className="sr-only" htmlFor="hist-type">Evento</label>
        <select id="hist-type" className={select} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
          <option value="all">Todos os eventos</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="relative min-w-40 flex-1">
          <Search className="pointer-events-none absolute left-2 top-2 size-4 text-ink-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar por tag ou mensagem"
            className="h-8 w-full rounded border border-line-strong bg-surface pl-8 pr-2 text-sm text-ink placeholder:text-ink-disabled"
          />
        </div>
      </div>
      <div className="max-h-[19rem] overflow-auto rounded border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-sunken">
            <tr>
              <th className={th}>Hora</th>
              <th className={th}>Prioridade</th>
              <th className={th}>Evento</th>
              <th className={th}>Origem</th>
              <th className={th}>Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-2 py-6 text-center text-ink-muted">Nenhum evento para os filtros escolhidos</td>
              </tr>
            ) : (
              filtered.map((e) => (
                <tr key={e.seq} className="border-t border-line">
                  <td className={cn(td, 'num whitespace-nowrap text-ink-default')}>{formatTime(e.time)}</td>
                  <td className={td}>
                    {e.priority === 'info' ? (
                      <StatusBadge status="neutral" label={PRIORITY_LABEL.info} />
                    ) : (
                      <StatusBadge status={e.priority} />
                    )}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap text-ink-default')}>{e.type}</td>
                  <td className={cn(td, 'font-mono text-xs text-ink-default')}>{e.source}</td>
                  <td className={cn(td, 'text-ink')}>{e.message}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
