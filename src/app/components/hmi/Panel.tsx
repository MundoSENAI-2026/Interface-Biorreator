import type { ReactNode } from 'react';
import { cn } from '../ui/utils';

interface PanelProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

/** Card padrão do painel: borda sutil, título discreto, sem sombras decorativas. */
export function Panel({ title, subtitle, actions, children, className, bodyClassName }: PanelProps) {
  return (
    <section data-layout-card="true" className={cn('flex flex-col rounded-md border border-line bg-surface', className)}>
      <header className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2">
        <div className="flex min-w-0 items-baseline gap-3">
          <h2 className="text-[15px] font-semibold uppercase tracking-wide text-ink-default">{title}</h2>
          {subtitle && <span className="text-sm text-ink-muted">{subtitle}</span>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className={cn('flex-1 p-4', bodyClassName)}>{children}</div>
    </section>
  );
}
