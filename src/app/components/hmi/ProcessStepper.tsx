import { Check } from 'lucide-react';
import type { PhaseConfig } from '../../config/plant';
import type { BatchStatus } from '../../data/types';
import { formatDuration } from '../../lib/format';
import { cn } from '../ui/utils';

interface ProcessStepperProps {
  phases: PhaseConfig[];
  currentIndex: number;
  status: BatchStatus;
  elapsedS: number;
  durationsS: (number | null)[];
}

/** Barra de etapas: concluídas (com tempo real), atual (decorrido/nominal) e pendentes (nominal). */
export function ProcessStepper({ phases, currentIndex, status, elapsedS, durationsS }: ProcessStepperProps) {
  const finished = status === 'completed';

  return (
    <ol className="grid gap-px overflow-hidden rounded-md border border-line bg-line" style={{ gridTemplateColumns: `repeat(${phases.length}, minmax(0, 1fr))` }}>
      {phases.map((phase, i) => {
        const done = i < currentIndex || (finished && i === currentIndex);
        const current = i === currentIndex && !finished;
        const nominalS = phase.durationMin * 60;
        const progress = current ? Math.min(1, elapsedS / nominalS) : 0;

        return (
          <li
            key={phase.id}
            aria-current={current ? 'step' : undefined}
            className={cn('relative flex min-h-[4rem] flex-col gap-1 px-2.5 py-1.5 transition-colors duration-200', current ? 'bg-st-info-bg' : 'bg-surface')}
          >
            <div className="flex flex-col items-start gap-1 2xl:flex-row 2xl:items-center 2xl:gap-2">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border text-[13px] font-semibold num',
                  done && 'border-ink-default bg-ink-default text-white',
                  current && 'border-st-info bg-st-info text-white',
                  !done && !current && 'border-line-strong bg-surface text-ink-muted',
                )}
                aria-hidden
              >
                {done ? <Check className="size-3" strokeWidth={3} /> : i + 1}
              </span>
              <span className={cn('text-sm leading-tight 2xl:text-[15px]', current ? 'font-semibold text-st-info' : done ? 'text-ink' : 'text-ink-muted')}>
                {phase.name}
              </span>
            </div>
            <span className="text-[13px] text-ink-muted num">
              {done && <>Concluída · {formatDuration(durationsS[i] ?? nominalS)}</>}
              {current && (
                <>
                  {status === 'running' ? 'Em curso' : status === 'emergency' ? 'Interrompida' : 'Pausada'} ·{' '}
                  {formatDuration(elapsedS)}/{formatDuration(nominalS)}
                </>
              )}
              {!done && !current && <>Prevista · {formatDuration(nominalS)}</>}
            </span>
            {current && (
              <div className="absolute inset-x-0 bottom-0 h-1 bg-st-info/15">
                <div className="h-full bg-st-info transition-[width] duration-200" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
