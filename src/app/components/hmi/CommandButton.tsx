import { Lock, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { plantStore, usePlant } from '../../data/source';
import type { Command } from '../../data/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { cn } from '../ui/utils';

export interface ConfirmSpec {
  title: string;
  description: string;
  confirmLabel?: string;
}

interface CommandButtonProps {
  command: Command;
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary';
  confirm?: ConfirmSpec;
  /** Motivo de bloqueio comum já exibido pelo painel — não repete abaixo do botão. */
  sharedReason?: string | null;
  className?: string;
  /** Classe extra do texto de bloqueio (ex.: ocupar a linha inteira de um grid). */
  reasonClassName?: string;
}

const VARIANT = {
  primary: 'bg-brand text-white border-brand hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border-line-strong hover:bg-sunken',
};

/**
 * Botão de comando com intertravamento visível (motivo do bloqueio) e
 * diálogo de confirmação para ações críticas.
 */
export function CommandButton({ command, label, icon: Icon, variant = 'secondary', confirm, sharedReason, className, reasonClassName }: CommandButtonProps) {
  usePlant(); // reavalia o intertravamento a cada leitura
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reason = plantStore.blockReason(command);
  const disabled = !!reason || busy;

  const execute = async () => {
    setBusy(true);
    setError(null);
    const result = await plantStore.send(command);
    setBusy(false);
    if (!result.ok) {
      setError(result.reason ?? 'Comando recusado');
      setTimeout(() => setError(null), 6000);
    }
  };

  const onClick = () => (confirm ? setOpen(true) : execute());
  const visibleReason = error ?? (reason && reason !== sharedReason ? reason : null);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={reason ?? undefined}
        className={cn(
          'inline-flex h-9 items-center justify-center gap-2 rounded border px-3 text-sm transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          VARIANT[variant],
          disabled && 'cursor-not-allowed border-line bg-sunken text-ink-disabled hover:bg-sunken',
        )}
      >
        {reason ? <Lock className="size-4" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
        {busy ? 'Enviando…' : label}
      </button>
      {visibleReason && (
        <p className={cn('flex items-start gap-1 text-xs leading-snug text-ink-muted', reasonClassName)} role="status">
          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
          <span>{visibleReason}</span>
        </p>
      )}

      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={execute}>{confirm.confirmLabel ?? 'Confirmar'}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
