import { Activity, Bell, ChevronLeft, ChevronRight, Download, Search, UserRound, type LucideIcon } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PLANT } from '../../config/plant';
import { LEVEL_LABEL, LEVELS } from '../../data/alarmStats';
import type { Alarm, AlarmState, EventCategory, IsaPriority, PlantEvent } from '../../data/types';
import { formatDate, formatTime } from '../../lib/format';
import { cn } from '../ui/utils';
import { StatusBadge } from './StatusBadge';

const STATE_ORDER: Record<AlarmState, number> = { active: 0, normalized: 1, acknowledged: 2 };
const LEVEL_ORDER: Record<IsaPriority, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

export const CATEGORY: Record<EventCategory, { label: string; short: string; icon: LucideIcon }> = {
  alarm: { label: 'Alarme', short: 'Alarme', icon: Bell },
  process: { label: 'Evento de processo', short: 'Processo', icon: Activity },
  operator: { label: 'Ação do operador', short: 'Operador', icon: UserRound },
};

/**
 * Tipo do evento com ícone e cor próprios: alarme na cor da severidade (com a
 * prioridade ISA), evento de processo em neutro, ação do operador em azul.
 */
export function EventTypeBadge({ event, compact }: { event: PlantEvent; compact?: boolean }) {
  const c = CATEGORY[event.category];
  if (event.category === 'alarm' && event.priority) {
    const level = event.level ? LEVEL_LABEL[event.level] : '';
    return <StatusBadge status={event.priority} icon={c.icon} label={compact ? c.short : `Alarme · ${level}`} className="shrink-0" />;
  }
  return <StatusBadge status={event.category === 'operator' ? 'info' : 'neutral'} icon={c.icon} label={compact ? c.short : c.label} className="shrink-0" />;
}

/** Ordenação ISA-18.2: prioridade, depois não reconhecidos, depois mais recentes. */
export function sortAlarms(alarms: Alarm[]) {
  return [...alarms].sort(
    (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] || STATE_ORDER[a.state] - STATE_ORDER[b.state] || b.activatedAt - a.activatedAt,
  );
}

const th = 'bg-sunken px-3 py-2 text-left text-[13px] font-semibold uppercase tracking-wide text-ink-muted';
const td = 'px-3 align-middle';
const ROW_H = 40;

const csvCell = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV com ";" e BOM UTF-8 — abre direto no Excel em português. */
function exportCsv(events: PlantEvent[]) {
  const header = ['Data', 'Hora', 'Tipo', 'Prioridade', 'Origem', 'Ação', 'Mensagem', 'Usuário'];
  const lines = events.map((e) =>
    [
      formatDate(e.time),
      formatTime(e.time),
      CATEGORY[e.category].label,
      e.category === 'alarm' && e.level ? LEVEL_LABEL[e.level] : '',
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

/** Quantas linhas cabem na altura disponível (paginação em vez de rolagem interna). */
function useRowsThatFit(ref: React.RefObject<HTMLElement | null>, rowHeight: number, headerHeight: number) {
  const [rows, setRows] = useState(10);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Mede o cabeçalho e a linha reais (fonte e bordas incluídas)
    const update = () => {
      const head = el.querySelector('thead')?.getBoundingClientRect().height || headerHeight;
      const row = el.querySelector('tbody tr')?.getBoundingClientRect().height || rowHeight;
      setRows(Math.max(3, Math.floor((el.clientHeight - head) / row)));
    };
    update();
    document.fonts?.ready.then(update);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, rowHeight, headerHeight]);
  return rows;
}

/** Histórico filtrável de todos os eventos (alarmes, processo e operador), paginado e com exportação CSV. */
export function HistoryTable({ events }: { events: PlantEvent[] }) {
  const [category, setCategory] = useState<'all' | EventCategory>('all');
  const [level, setLevel] = useState<'all' | IsaPriority>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);
  const pageSize = useRowsThatFit(boxRef, ROW_H, 38);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter(
      (e) =>
        (category === 'all' || e.category === category) &&
        (level === 'all' || e.level === level) &&
        (!q || [e.source, e.message, e.action, e.user ?? ''].some((f) => f.toLowerCase().includes(q))),
    );
  }, [events, category, level, query]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => setPage(0), [category, level, query]);
  const current = Math.min(page, pages - 1);
  const rows = filtered.slice(current * pageSize, (current + 1) * pageSize);

  const select = 'h-9 rounded border border-line-strong bg-surface px-2 text-sm text-ink';
  const pageBtn = 'inline-flex size-9 items-center justify-center rounded border border-line-strong bg-surface text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled';

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
        <label className="sr-only" htmlFor="hist-level">Prioridade</label>
        <select id="hist-level" className={select} value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
          <option value="all">Todas as prioridades</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>{LEVEL_LABEL[l]}</option>
          ))}
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
        <button
          onClick={() => exportCsv(filtered)}
          disabled={filtered.length === 0}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled"
        >
          <Download className="size-4" aria-hidden />
          Exportar CSV
        </button>
      </div>

      <div ref={boxRef} className="min-h-0 flex-1 overflow-hidden rounded border border-line">
        <table className="w-full table-fixed border-collapse text-[15px]">
          <colgroup>
            <col className="w-24" />
            <col className="w-32 2xl:w-48" />
            <col className="w-28 2xl:w-32" />
            <col className="hidden w-40 2xl:table-column" />
            <col />
            <col className="w-36 2xl:w-40" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Hora</th>
              <th className={th}>Tipo</th>
              <th className={th}>Origem</th>
              <th className={cn(th, 'hidden 2xl:table-cell')}>Ação</th>
              <th className={th}>Mensagem</th>
              <th className={th}>Usuário</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-ink-muted">Nenhum evento para os filtros escolhidos</td>
              </tr>
            ) : (
              rows.map((e) => (
                <tr key={e.seq} className="border-t border-line" style={{ height: ROW_H }}>
                  <td className={cn(td, 'whitespace-nowrap text-ink-default num')}>{formatTime(e.time)}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>
                    <span className="2xl:hidden"><EventTypeBadge event={e} compact /></span>
                    <span className="hidden 2xl:inline"><EventTypeBadge event={e} /></span>
                  </td>
                  <td className={cn(td, 'truncate font-mono text-[13px] text-ink-default')}>{e.source}</td>
                  <td className={cn(td, 'hidden truncate whitespace-nowrap text-ink-default 2xl:table-cell')}>{e.action}</td>
                  <td className={cn(td, 'truncate text-ink')} title={e.message}>{e.message}</td>
                  <td className={cn(td, 'truncate whitespace-nowrap', e.category === 'operator' ? 'font-medium text-st-info' : 'text-ink-muted')}>{e.user}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted num">
        <span>
          {filtered.length === 0 ? '0 eventos' : `${current * pageSize + 1}–${Math.min(filtered.length, (current + 1) * pageSize)} de ${filtered.length} eventos`}
          {filtered.length !== events.length && ` (filtrados de ${events.length})`}
        </span>
        <div className="flex items-center gap-2">
          <button className={pageBtn} onClick={() => setPage(current - 1)} disabled={current === 0} aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </button>
          <span>Página {current + 1} de {pages}</span>
          <button className={pageBtn} onClick={() => setPage(current + 1)} disabled={current >= pages - 1} aria-label="Próxima página">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
