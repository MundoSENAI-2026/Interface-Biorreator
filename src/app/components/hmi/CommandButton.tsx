import type { LucideIcon } from 'lucide-react';
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
  className?: string;
  /** Classe extra do texto de intertravamento (ex.: ocupar a linha inteira de um grid). */
  reasonClassName?: string;
}

const VARIANT = {
  primary: 'bg-brand text-white border-brand hover:bg-brand-strong',
  secondary: 'bg-surface text-ink border-line-strong hover:bg-sunken',
};

/**
 * Botão de comando com diálogo de confirmação para ações críticas.
 * Bloqueado = apenas desabilitado; o texto aparece só para intertravamento de
 * segurança (o bloqueio comum é exibido uma única vez pelo painel).
 */
export function CommandButton({ command, label, icon: Icon, variant = 'secondary', confirm, className, reasonClassName }: CommandButtonProps) {
  usePlant(); // reavalia o intertravamento a cada leitura
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const block = plantStore.blockReason(command);
  const disabled = !!block || busy;

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

  const visibleReason = error ?? (block?.kind === 'interlock' ? block.message : null);

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <button
        type="button"
        onClick={() => (confirm ? setOpen(true) : execute())}
        disabled={disabled}
        title={block?.message}
        className={cn(
          'inline-flex h-10 items-center justify-center gap-2 rounded border px-4 text-[15px] transition-colors duration-150',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          disabled ? 'cursor-not-allowed border-line bg-sunken text-ink-disabled' : VARIANT[variant],
        )}
      >
        {Icon && <Icon className="size-4" aria-hidden />}
        {busy ? 'Enviando…' : label}
      </button>
      {visibleReason && (
        <p className={cn('text-[13px] leading-snug text-st-warning-text', reasonClassName)} role="status">
          {visibleReason}
        </p>
      )}

      {confirm && (
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription className="text-[15px]">{confirm.description}</AlertDialogDescription>
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
