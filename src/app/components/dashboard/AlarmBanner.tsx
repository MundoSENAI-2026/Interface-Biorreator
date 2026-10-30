import { Check, CircleCheck } from 'lucide-react';
import { plantStore } from '../../data/source';
import type { Alarm } from '../../data/types';
import { uiStore } from '../../data/ui';
import { formatTime } from '../../lib/format';
import { sortAlarms } from '../hmi/AlarmList';
import { StatusBadge } from '../hmi/StatusBadge';
import { cn } from '../ui/utils';

const MAX_ROWS = 3;

const STATE_LABEL = { active: 'Ativo', acknowledged: 'Reconhecido', normalized: 'Normalizado' } as const;

/** Faixa de alarmes da Visão Geral: uma linha quando vazia, até 3 alarmes quando houver. */
export function AlarmBanner({ alarms }: { alarms: Alarm[] }) {
  if (alarms.length === 0) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-[15px] text-ink-default">
        <CircleCheck className="size-5 text-st-normal" aria-hidden />
        Sem alarmes ativos
      </div>
    );
  }

  const sorted = sortAlarms(alarms);
  const shown = sorted.slice(0, MAX_ROWS);
  const hidden = sorted.length - shown.length;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-line bg-surface">
      {shown.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex h-11 items-center gap-4 border-b border-line px-4 text-[15px] transition-colors duration-200 last:border-b-0',
            a.state === 'active' && (a.priority === 'critical' ? 'bg-st-critical-bg' : 'bg-st-warning-bg'),
          )}
        >
          <StatusBadge status={a.priority} size="md" className="w-28 justify-center" />
          <span className="w-20 text-ink-default num">{formatTime(a.activatedAt)}</span>
          <span className="w-28 font-mono text-sm text-ink-default">{a.source}</span>
          <span className={cn('min-w-0 flex-1 truncate', a.state === 'normalized' ? 'text-ink-muted' : 'text-ink')}>{a.message}</span>
          <span className={cn('w-28', a.state === 'active' ? 'font-semibold text-ink' : 'text-ink-muted')}>{STATE_LABEL[a.state]}</span>
          {a.state !== 'acknowledged' ? (
            <button
              onClick={() => plantStore.acknowledge(a.id)}
              className="inline-flex h-8 w-32 items-center justify-center gap-1.5 rounded border border-line-strong bg-surface text-sm text-ink hover:bg-sunken"
            >
              <Check className="size-4" aria-hidden />
              Reconhecer
            </button>
          ) : (
            <span className="w-32" />
          )}
        </div>
      ))}
      {hidden > 0 && (
        <button
          onClick={() => uiStore.navigate('alarms')}
          className="h-9 border-t border-line bg-sunken text-sm font-medium text-brand hover:underline"
        >
          + {hidden} {hidden === 1 ? 'alarme' : 'alarmes'} — ver todos em Alarmes e Eventos (F4)
        </button>
      )}
    </div>
  );
}
