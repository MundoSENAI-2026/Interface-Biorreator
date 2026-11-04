import { useEffect } from 'react';
import { usePlant } from '../../data/source';
import { SCREENS, uiStore, useUi } from '../../data/ui';
import { PRESENTATION } from '../../config/project';
import { cn } from '../ui/utils';

/** Barra de navegação estilo SCADA: abas fixas com atalhos F1–F6. */
export function NavBar() {
  const { screen, presentation, rotation, caption } = useUi();
  const plant = usePlant();
  const unacked = plant.alarms.filter((a) => a.state !== 'acknowledged').length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const target = SCREENS.find((s) => s.key === e.key);
      if (target) {
        e.preventDefault(); // F1 (ajuda), F3 (busca), F5 (recarregar) etc. ficam com a IHM
        uiStore.navigate(target.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <nav aria-label="Telas" className="flex items-center justify-between gap-4 border-b border-line-strong bg-surface px-6">
      <ul role="tablist" className="flex gap-1">
        {SCREENS.map((s) => {
          const active = s.id === screen;
          return (
            <li key={s.id}>
              <button
                role="tab"
                aria-selected={active}
                onClick={() => uiStore.navigate(s.id)}
                className={cn(
                  'relative flex h-12 items-center gap-2 px-4 text-[15px] transition-colors duration-150',
                  active ? 'font-semibold text-brand' : 'text-ink-default hover:bg-sunken hover:text-ink',
                )}
              >
                <kbd className={cn('rounded border px-1.5 font-mono text-[13px] leading-5', active ? 'border-brand/40 text-brand' : 'border-line-strong text-ink-muted')}>
                  {s.key}
                </kbd>
                {s.label}
                {s.id === 'alarms' && unacked > 0 && (
                  <span className="rounded-full bg-st-critical px-2 text-[13px] font-semibold leading-5 text-white num" aria-label={`${unacked} não reconhecidos`}>
                    {unacked}
                  </span>
                )}
                {active && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t bg-brand" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {presentation && (
        <span className="whitespace-nowrap rounded border border-line px-2.5 py-1 text-sm text-ink-muted num" role="status">
          Modo apresentação ·{' '}
          {caption
            ? 'demonstração em andamento'
            : rotation.pausedUntil
              ? `rotação pausada · retoma em ${Math.max(0, Math.ceil((rotation.pausedUntil - plant.now) / 1000))} s`
              : rotation.nextAt
                ? `próxima tela em ${Math.max(0, Math.ceil((rotation.nextAt - plant.now) / 1000))} s`
                : ''}
          <span className="ml-2 text-[13px]">({PRESENTATION.key.toUpperCase()} para sair)</span>
        </span>
      )}
    </nav>
  );
}
