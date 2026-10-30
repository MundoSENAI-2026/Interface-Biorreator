import { OctagonX, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { plantStore } from '../../data/source';
import type { BatchStatus } from '../../data/types';
import { CommandButton } from '../hmi/CommandButton';

/**
 * Parada de emergência: separada dos demais comandos, formato e cor próprios
 * (vermelho sólido, reservado a emergência/crítico). Atua sem confirmação.
 */
export function EmergencyButton({ status }: { status: BatchStatus | null }) {
  const [error, setError] = useState<string | null>(null);

  if (status === 'emergency') {
    return (
      <CommandButton
        command={{ type: 'resetEmergency' }}
        label="Rearmar emergência"
        icon={RotateCcw}
        variant="secondary"
        confirm={{
          title: 'Rearmar a parada de emergência?',
          description:
            'Confirme que a causa da emergência foi verificada e que a área está segura. O processo voltará ao estado PARADO (modo manual).',
          confirmLabel: 'Rearmar',
        }}
      />
    );
  }

  const trigger = async () => {
    const result = await plantStore.send({ type: 'emergency' });
    setError(result.ok ? null : result.reason ?? 'Comando não confirmado pelo CLP');
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={trigger}
        className="inline-flex h-12 items-center gap-2 rounded-md bg-st-critical px-5 text-base font-bold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-st-critical-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-st-critical"
      >
        <OctagonX className="size-6" aria-hidden />
        Parada de emergência
      </button>
      {error && <span className="text-[13px] text-st-critical-text">{error}</span>}
    </div>
  );
}
