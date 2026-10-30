import type { ValveConfig } from '../../config/plant';
import type { ValveState } from '../../data/types';
import { cn } from '../ui/utils';
import { CommandButton } from './CommandButton';
import { StatusBadge, type BadgeStatus } from './StatusBadge';

export const VALVE_STATE_LABEL: Record<ValveState, string> = {
  open: 'Aberta',
  closed: 'Fechada',
  transition: 'Em transição',
  fault: 'Falha',
};

const VALVE_BADGE: Record<ValveState, BadgeStatus> = {
  open: 'info',
  closed: 'stopped',
  transition: 'transition',
  fault: 'warning',
};

/** Símbolo ISA de válvula (gravata): cheia = aberta, vazada = fechada. */
export function ValveGlyph({ state, className }: { state: ValveState; className?: string }) {
  const fill =
    state === 'open' ? 'fill-st-info stroke-st-info'
    : state === 'fault' ? 'fill-st-warning-bg stroke-st-warning-text'
    : 'fill-surface stroke-ink-muted';
  return (
    <svg viewBox="0 0 24 16" className={cn('h-4 w-6', className)} aria-hidden>
      <path
        d="M2 2 L12 8 L2 14 Z M22 2 L12 8 L22 14 Z"
        className={fill}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeDasharray={state === 'transition' ? '2 2' : undefined}
      />
    </svg>
  );
}

interface ValveControlProps {
  valve: ValveConfig;
  state: ValveState;
  sharedReason?: string | null;
}

export function ValveControl({ valve, state, sharedReason }: ValveControlProps) {
  const opening = state !== 'open';
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2.5 gap-y-1.5 rounded border border-line bg-surface px-2.5 py-2" title={`${valve.short} — ${valve.description}`}>
      <ValveGlyph state={state} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm font-medium text-ink">{valve.short}</span>
          <span className="text-sm text-ink-default">{valve.function}</span>
        </div>
        <StatusBadge status={VALVE_BADGE[state]} label={VALVE_STATE_LABEL[state]} className="mt-1" />
      </div>
      <CommandButton
        className="contents"
        reasonClassName="col-span-full"
        command={{ type: 'valve', id: valve.id, open: opening }}
        label={opening ? 'Abrir' : 'Fechar'}
        sharedReason={sharedReason}
        confirm={
          valve.confirm
            ? {
                title: `${opening ? 'Abrir' : 'Fechar'} ${valve.short}?`,
                description: `${valve.short} — ${valve.function}: ${valve.description}. Confirme o comando manual da válvula.`,
                confirmLabel: opening ? 'Abrir válvula' : 'Fechar válvula',
              }
            : undefined
        }
      />
    </div>
  );
}
