import type { LucideIcon } from 'lucide-react';
import { cn } from '../ui/utils';

export type ChipTone = 'normal' | 'warning' | 'critical' | 'info' | 'neutral' | 'good' | 'purple';

const TONE: Record<ChipTone, string> = {
  normal: 'border-line bg-st-normal-bg text-ink-default',
  warning: 'border-st-warning/50 bg-st-warning-bg text-st-warning-text',
  critical: 'border-st-critical bg-st-critical text-white',
  info: 'border-st-info/40 bg-st-info-bg text-st-info',
  neutral: 'border-line bg-sunken text-ink-muted',
  good: 'border-st-good/40 bg-st-good-bg text-st-good',
  purple: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

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
    <span title={title} className={cn('inline-flex h-6 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded border px-2 text-[13px] font-medium leading-none', TONE[tone], className)}>
      {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
      <span title={title ?? label} className="truncate">{label}</span>
    </span>
  );
}
