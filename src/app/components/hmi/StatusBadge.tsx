import {
  ArrowLeftRight,
  Circle,
  CircleCheck,
  CircleHelp,
  Info,
  OctagonAlert,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../ui/utils';

export type BadgeStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'info'
  | 'running'
  | 'stopped'
  | 'transition'
  | 'offline'
  | 'bad'
  | 'neutral'
  | 'good';

interface Variant {
  label: string;
  icon: LucideIcon | null;
  className: string;
  iconClassName?: string;
}

/** Paleta semântica única: todo status tem ícone + texto, nunca só cor. */
const VARIANTS: Record<BadgeStatus, Variant> = {
  normal: { label: 'Normal', icon: CircleCheck, className: 'bg-st-normal-bg text-ink-default border-line', iconClassName: 'text-st-normal' },
  warning: { label: 'Alerta', icon: TriangleAlert, className: 'bg-st-warning-bg text-st-warning-text border-st-warning', iconClassName: 'text-st-warning-text' },
  critical: { label: 'Crítico', icon: OctagonAlert, className: 'bg-st-critical text-white border-st-critical' },
  info: { label: 'Ativo', icon: Info, className: 'bg-st-info-bg text-st-info border-st-info/40' },
  running: { label: 'Em operação', icon: null, className: 'bg-surface text-ink-default border-line' },
  stopped: { label: 'Parado', icon: Circle, className: 'bg-surface text-ink-muted border-line', iconClassName: 'text-st-normal' },
  transition: { label: 'Em transição', icon: ArrowLeftRight, className: 'bg-surface text-ink-default border-line-strong border-dashed' },
  offline: { label: 'Offline', icon: WifiOff, className: 'bg-st-offline-bg text-ink-muted border-st-offline' },
  bad: { label: 'Dado não confiável', icon: CircleHelp, className: 'bg-st-offline-bg text-ink-muted border-st-offline border-dashed' },
  neutral: { label: '', icon: null, className: 'bg-st-normal-bg text-ink-default border-line' },
  good: { label: 'Em dia', icon: CircleCheck, className: 'bg-st-good-bg text-st-good border-st-good/40' },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function StatusBadge({ status, label, icon, size = 'sm', className }: StatusBadgeProps) {
  const variant = VARIANTS[status];
  const Icon = icon ?? variant.icon;
  const iconSize = size === 'lg' ? 'size-5' : size === 'md' ? 'size-4' : 'size-3.5';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded border font-medium leading-none transition-colors duration-200',
        size === 'lg' ? 'px-3 py-2 text-base' : size === 'md' ? 'px-2.5 py-1.5 text-sm' : 'px-2 py-1 text-[13px]',
        variant.className,
        className,
      )}
    >
      {status === 'running' && !icon ? (
        // Verde apenas no indicador, nunca no fundo
        <span className="inline-block size-2.5 rounded-full bg-st-running" aria-hidden />
      ) : (
        Icon && <Icon className={cn(iconSize, 'shrink-0', variant.iconClassName)} aria-hidden />
      )}
      {label ?? variant.label}
    </span>
  );
}
