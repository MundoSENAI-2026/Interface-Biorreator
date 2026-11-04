import { useEffect } from 'react';
import { PRESENTATION } from '../../config/project';
import { uiStore, useUi } from '../../data/ui';

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));

/**
 * Modo apresentação (tecla P): tela cheia, cursor some após inatividade e as abas
 * alternam a cada PRESENTATION.rotateEveryS. Um toque/clique pausa a rotação, que
 * retoma após PRESENTATION.resumeAfterS sem interação. Sair: P novamente ou Esc.
 */
export function PresentationMode() {
  const { presentation, caption } = useUi();

  // Liga/desliga pela tecla e acompanha a saída da tela cheia (Esc)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey || isTyping(e.target)) return;
      if (e.key.toLowerCase() !== PRESENTATION.key) return;
      e.preventDefault();
      const next = !uiStore.getState().presentation;
      uiStore.setPresentation(next);
      if (next) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    const onFullscreen = () => {
      if (!document.fullscreenElement && uiStore.getState().presentation) uiStore.setPresentation(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreen);
    };
  }, []);

  // Cursor oculto após inatividade
  useEffect(() => {
    if (!presentation) return;
    const root = document.documentElement;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      root.classList.remove('hide-cursor');
      clearTimeout(timer);
      timer = setTimeout(() => root.classList.add('hide-cursor'), PRESENTATION.hideCursorAfterS * 1000);
    };
    show();
    window.addEventListener('mousemove', show);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousemove', show);
      root.classList.remove('hide-cursor');
    };
  }, [presentation]);

  // Rotação automática das abas (pausada durante o cenário roteirizado)
  useEffect(() => {
    if (!presentation || caption) {
      uiStore.setRotation({ nextAt: null, pausedUntil: null });
      return;
    }
    const period = PRESENTATION.rotateEveryS * 1000;
    uiStore.setRotation({ nextAt: Date.now() + period, pausedUntil: null });

    const onInteract = () => uiStore.setRotation({ nextAt: null, pausedUntil: Date.now() + PRESENTATION.resumeAfterS * 1000 });
    const tick = setInterval(() => {
      const { rotation, screen } = uiStore.getState();
      const now = Date.now();
      if (rotation.pausedUntil !== null) {
        if (now >= rotation.pausedUntil) uiStore.setRotation({ nextAt: now + period, pausedUntil: null });
        return;
      }
      if (rotation.nextAt !== null && now >= rotation.nextAt) {
        const list = PRESENTATION.screens;
        const i = list.indexOf(screen as (typeof list)[number]);
        uiStore.navigate(list[(i + 1) % list.length]);
        uiStore.setRotation({ nextAt: now + period, pausedUntil: null });
      }
    }, 250);

    window.addEventListener('pointerdown', onInteract);
    window.addEventListener('touchstart', onInteract);
    window.addEventListener('wheel', onInteract);
    return () => {
      clearInterval(tick);
      window.removeEventListener('pointerdown', onInteract);
      window.removeEventListener('touchstart', onInteract);
      window.removeEventListener('wheel', onInteract);
    };
  }, [presentation, caption]);

  return null;
}
