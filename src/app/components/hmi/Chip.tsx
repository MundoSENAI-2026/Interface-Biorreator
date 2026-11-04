import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/utils';

export type ChipTone = 'normal' | 'warning' | 'high' | 'critical' | 'info' | 'neutral' | 'good' | 'purple';

const TONE: Record<ChipTone, string> = {
  normal: 'border-line bg-st-normal-bg text-ink-default',
  warning: 'border-st-warning/50 bg-st-warning-bg text-st-warning-text',
  /** Prioridade alta: âmbar cheio (a média usa o âmbar claro de 'warning'). */
  high: 'border-st-warning bg-st-warning text-ink',
  critical: 'border-st-critical bg-st-critical text-white',
  info: 'border-st-info/40 bg-st-info-bg text-st-info',
  neutral: 'border-line bg-sunken text-ink-muted',
  good: 'border-st-good/40 bg-st-good-bg text-st-good',
  purple: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

/** Selo de texto curto. O texto nunca é cortado: quem usa garante a largura (ou um rótulo menor). */
export function Chip({
  label,
  tone = 'neutral',
  icon: Icon,
  className,
  title,
}: {
  label: string;
  tone?: ChipTone;
  icon?: LucideIcon;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className={cn('inline-flex h-6 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded border px-2 text-[13px] font-medium leading-none', TONE[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span>{label}</span>
    </span>
  );
}
