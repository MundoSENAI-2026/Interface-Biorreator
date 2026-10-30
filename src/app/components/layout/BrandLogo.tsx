import { useState } from 'react';
import { PROJECT } from '../../config/project';
import { cn } from '../ui/utils';

/**
 * Logotipo SENAI (arquivo local em public/brand/). Não é recriado com texto:
 * se o arquivo faltar, mostra um espaço reservado indicando onde colocá-lo.
 */
export function BrandLogo({ className = 'h-10' }: { className?: string }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        className={cn('flex w-32 items-center justify-center rounded border border-dashed border-line-strong px-2 text-center text-[13px] leading-tight text-ink-muted', className)}
        title={`Coloque o logotipo em public${PROJECT.logoSrc}`}
      >
        Logo SENAI · public/brand/
      </div>
    );
  }

  return <img src={PROJECT.logoSrc} alt="SENAI São Paulo" className={cn('w-auto shrink-0', className)} onError={() => setMissing(true)} />;
}
