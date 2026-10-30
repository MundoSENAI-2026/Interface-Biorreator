import { MonitorPlay, X } from 'lucide-react';
import { demoScenario } from '../../data/demoScenario';
import { useUi } from '../../data/ui';

/** Legenda do cenário de demonstração: canto inferior esquerdo (as notificações ficam à direita). */
export function DemoCaption() {
  const { caption } = useUi();
  if (!caption) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-12 left-4 z-40 flex max-w-[44rem] items-start gap-3 rounded-md border border-brand/40 bg-surface px-4 py-3 shadow-lg"
    >
      <MonitorPlay className="mt-0.5 size-6 shrink-0 text-brand" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand num">
          Demonstração · {caption.step}/{caption.total}
        </p>
        <p className="text-lg leading-snug text-ink">{caption.text}</p>
      </div>
      <button onClick={() => demoScenario.stop()} className="rounded p-1 text-ink-muted hover:bg-sunken" aria-label="Encerrar demonstração">
        <X className="size-5" />
      </button>
    </div>
  );
}
