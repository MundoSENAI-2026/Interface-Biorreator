import { Check, CheckCheck, CircleCheck } from 'lucide-react';
import { plantStore } from '../../data/source';
import type { Alarm } from '../../data/types';
import { uiStore } from '../../data/ui';
import { formatTime } from '../../lib/format';
import { PriorityChip, sortAlarms } from '../hmi/AlarmList';
import { cn } from '../ui/utils';

const STATE_LABEL = { active: 'Ativo', acknowledged: 'Reconhecido', normalized: 'Normalizado' } as const;

interface AlarmBannerProps {
  alarms: Alarm[];
  /** Horário do último alarme normalizado (informação útil quando não há alarmes). */
  lastNormalizedAt?: number | null;
  maxRows?: number;
  /** Mostra o atalho para a tela de alarmes quando há mais alarmes que linhas. */
  linkToAlarms?: boolean;
  /** Mostra o cabeçalho "Alarmes ativos" com o botão "Reconhecer todos" (tela F4). */
  showAcknowledgeAll?: boolean;
}

/** Faixa de alarmes ativos: uma linha quando vazia, até `maxRows` alarmes quando houver. */
export function AlarmBanner({ alarms, lastNormalizedAt, maxRows = 3, linkToAlarms = true, showAcknowledgeAll = false }: AlarmBannerProps) {
  if (alarms.length === 0) {
    return (
      <div className="flex h-11 items-center gap-2 rounded-md border border-line bg-surface px-4 text-[15px] text-ink-default">
        <CircleCheck className="size-5 text-st-normal" aria-hidden />
        Nenhum alarme ativo
        {lastNormalizedAt && <span className="text-ink-muted num">· último alarme normalizado às {formatTime(lastNormalizedAt).slice(0, 5)}</span>}
      </div>
    );
  }

  const sorted = sortAlarms(alarms);
  const shown = sorted.slice(0, maxRows);
  const hidden = sorted.length - shown.length;
  const pending = alarms.filter((a) => a.state !== 'acknowledged').length;

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-line bg-surface">
      {showAcknowledgeAll && (
        <div className="flex h-11 items-center justify-between gap-4 border-b border-line px-4">
          <h2 className="text-[15px] font-semibold uppercase tracking-wide text-ink-default">
            Alarmes ativos <span className="font-normal normal-case tracking-normal text-ink-muted num">· {alarms.length} no total, {pending} não reconhecido{pending === 1 ? '' : 's'}</span>
          </h2>
          <button
            onClick={() => plantStore.acknowledgeAll()}
            disabled={pending === 0}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-line-strong bg-surface px-3 text-sm text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            <CheckCheck className="size-4" aria-hidden />
            Reconhecer todos
          </button>
        </div>
      )}
      {shown.map((a) => (
        <div
          key={a.id}
          className={cn(
            'flex min-h-11 items-center gap-4 border-b border-line px-4 py-1 text-[15px] transition-colors duration-200 last:border-b-0',
            a.state === 'active' && (a.priority === 'critical' ? 'bg-st-critical-bg' : 'bg-st-warning-bg'),
          )}
        >
          <PriorityChip level={a.level} />
          <span className="w-20 shrink-0 text-ink-default num">{formatTime(a.activatedAt)}</span>
          <span className="w-28 shrink-0 font-mono text-sm text-ink-default">{a.source}</span>
          <span className={cn('min-w-0 flex-1 leading-5', a.state === 'normalized' ? 'text-ink-muted' : 'text-ink')}>{a.message}</span>
          <span className={cn('w-28 shrink-0', a.state === 'active' ? 'font-semibold text-ink' : 'text-ink-muted')}>{STATE_LABEL[a.state]}</span>
          {a.state !== 'acknowledged' ? (
            <button
              onClick={() => plantStore.acknowledge(a.id)}
              className="inline-flex h-8 w-32 shrink-0 items-center justify-center gap-1.5 rounded border border-line-strong bg-surface text-sm text-ink hover:bg-sunken"
            >
              <Check className="size-4" aria-hidden />
              Reconhecer
            </button>
          ) : (
            <span className="w-32 shrink-0" />
          )}
        </div>
      ))}
      {hidden > 0 && !linkToAlarms && (
        <div className="h-9 border-t border-line bg-sunken px-4 text-sm leading-9 text-ink-muted">+ {hidden} {hidden === 1 ? 'alarme' : 'alarmes'} de menor prioridade</div>
      )}
      {hidden > 0 && linkToAlarms && (
        <button
          onClick={() => uiStore.navigate('alarms')}
          className="h-9 border-t border-line bg-sunken text-sm font-medium text-brand hover:underline"
        >
          + {hidden} {hidden === 1 ? 'alarme' : 'alarmes'} · ver todos em Alarmes e Eventos (F4)
        </button>
      )}
    </div>
  );
}
