import { OctagonAlert, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Toaster, toast } from 'sonner';
import { MAX_VISIBLE_TOASTS } from '../../config/plant';
import { plantStore } from '../../data/source';
import { formatTime } from '../../lib/format';

/** Não repete a notificação do mesmo alarme dentro desta janela (alarme "piscando"). */
const REPEAT_SUPPRESS_MS = 60_000;

/**
 * Notificações de alarme: canto inferior direito (não cobre cabeçalho/relógio),
 * no máximo MAX_VISIBLE_TOASTS visíveis, uma por alarme (id = id do alarme)
 * e somente na ATIVAÇÃO. O histórico completo fica no painel de alarmes.
 */
export function AlarmToasts() {
  useEffect(() => {
    const lastShown = new Map<string, number>();
    return plantStore.onAlarmRaised((alarm) => {
      const now = Date.now();
      if (now - (lastShown.get(alarm.id) ?? 0) < REPEAT_SUPPRESS_MS) return;
      lastShown.set(alarm.id, now);

      const critical = alarm.priority === 'critical';
      const Icon = critical ? OctagonAlert : TriangleAlert;
      toast.custom(
        (id) => (
          <div
            className={
              critical
                ? 'flex w-[22rem] items-start gap-3 rounded-md border border-st-critical border-l-4 bg-surface p-3 shadow-md'
                : 'flex w-[22rem] items-start gap-3 rounded-md border border-st-warning border-l-4 bg-surface p-3 shadow-md'
            }
          >
            <Icon className={critical ? 'mt-0.5 size-5 shrink-0 text-st-critical' : 'mt-0.5 size-5 shrink-0 text-st-warning-text'} aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-ink">
                {critical ? 'Alarme crítico' : 'Alerta'} · <span className="font-mono text-xs">{alarm.source}</span>
              </p>
              <p className="text-ink-default">{alarm.message}</p>
              <p className="mt-0.5 text-xs text-ink-muted num">{formatTime(alarm.activatedAt)}</p>
            </div>
            <button
              onClick={() => {
                plantStore.acknowledge(alarm.id);
                toast.dismiss(id);
              }}
              className="shrink-0 rounded border border-line-strong px-2 py-1 text-xs text-ink hover:bg-sunken"
            >
              Reconhecer
            </button>
          </div>
        ),
        { id: alarm.id, duration: critical ? 10_000 : 6_000 },
      );
    });
  }, []);

  return <Toaster position="bottom-right" visibleToasts={MAX_VISIBLE_TOASTS} gap={8} offset={16} />;
}
