import { PROJECT } from '../../config/project';

/** Rodapé fixo e discreto com a identificação do projeto (dados do config). */
export function Footer() {
  return (
    <footer className="flex h-8 shrink-0 items-center justify-between gap-4 border-t border-line bg-surface px-6 text-[13px] text-ink-muted">
      <span className="truncate">
        <strong className="font-semibold text-ink-default">{PROJECT.event}</strong>
        <span className="mx-2" aria-hidden>·</span>
        {PROJECT.school}
        <span className="mx-2" aria-hidden>·</span>
        {PROJECT.course}
      </span>
      <span className="shrink-0 num">Versão {PROJECT.version}</span>
    </footer>
  );
}
