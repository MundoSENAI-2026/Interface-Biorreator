import { useState } from 'react';
import { PROJECT } from '../../config/project';

/**
 * Logotipo oficial SENAI (arquivo em public/brand/). Não é recriado com texto:
 * se o arquivo ainda não existir, mostra um espaço reservado indicando onde colocá-lo.
 */
export function BrandLogo() {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div
        className="flex h-10 w-32 items-center justify-center rounded border border-dashed border-line-strong px-2 text-center text-[13px] leading-tight text-ink-muted"
        title={`Coloque o logotipo oficial em public${PROJECT.logoSrc}`}
      >
        Logo SENAI
        <br />
        public/brand/
      </div>
    );
  }

  return <img src={PROJECT.logoSrc} alt="SENAI" className="h-10 w-auto" onError={() => setMissing(true)} />;
}
