import { ArrowLeftRight, Circle, CircleCheck, CircleHelp, Info, OctagonAlert, TriangleAlert, WifiOff, type LucideIcon } from 'lucide-react';
import { Chip, type ChipTone } from './Chip';

export type BadgeStatus = 'normal' | 'warning' | 'critical' | 'info' | 'running' | 'stopped' | 'transition' | 'offline' | 'bad' | 'neutral' | 'good';

const VARIANTS: Record<BadgeStatus, { label: string; icon: LucideIcon | null; tone: ChipTone }> = {
  normal: { label: 'Normal', icon: CircleCheck, tone: 'normal' },
  warning: { label: 'Alerta', icon: TriangleAlert, tone: 'warning' },
  critical: { label: 'Crítico', icon: OctagonAlert, tone: 'critical' },
  info: { label: 'Ativo', icon: Info, tone: 'info' },
  running: { label: 'Em operação', icon: Circle, tone: 'good' },
  stopped: { label: 'Parado', icon: Circle, tone: 'neutral' },
  transition: { label: 'Em transição', icon: ArrowLeftRight, tone: 'neutral' },
  offline: { label: 'Offline', icon: WifiOff, tone: 'neutral' },
  bad: { label: 'Dado não confiável', icon: CircleHelp, tone: 'neutral' },
  neutral: { label: '', icon: null, tone: 'normal' },
  good: { label: 'Em dia', icon: CircleCheck, tone: 'good' },
};

interface StatusBadgeProps {
  status: BadgeStatus;
  label?: string;
  icon?: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** Compatibilidade de API: todos os status usam o Chip padronizado. */
export function StatusBadge({ status, label, icon, className }: StatusBadgeProps) {
  const variant = VARIANTS[status];
  return <Chip label={label ?? variant.label} tone={variant.tone} icon={icon ?? variant.icon ?? undefined} className={className} />;
}
