import { useSyncExternalStore } from 'react';

/** Telas do supervisório (abas), na ordem dos atalhos F1–F6. */
export const SCREENS = [
  { id: 'overview', label: 'Visão Geral', key: 'F1' },
  { id: 'synoptic', label: 'Sinótico', key: 'F2' },
  { id: 'trends', label: 'Tendências', key: 'F3' },
  { id: 'alarms', label: 'Alarmes e Eventos', key: 'F4' },
  { id: 'maintenance', label: 'Manutenção (ML)', key: 'F5' },
  { id: 'about', label: 'Sobre o Projeto', key: 'F6' },
] as const;

export type ScreenId = (typeof SCREENS)[number]['id'];

export interface DemoCaption {
  step: number;
  total: number;
  text: string;
}

export interface UiState {
  screen: ScreenId;
  /** Legenda do cenário roteirizado de demonstração (null = cenário parado). */
  caption: DemoCaption | null;
  presentation: boolean;
  /** Rotação automática de abas no modo apresentação. */
  rotation: { nextAt: number | null; pausedUntil: number | null };
}

type Listener = () => void;

const isScreen = (id: string): id is ScreenId => SCREENS.some((s) => s.id === id);
const fromHash = (): ScreenId => {
  const id = location.hash.replace(/^#\/?/, '');
  return isScreen(id) ? id : 'overview';
};

/** Estado de interface (navegação, modo apresentação, legenda da demonstração). */
class UiStore {
  private state: UiState = {
    screen: fromHash(),
    caption: null,
    presentation: false,
    rotation: { nextAt: null, pausedUntil: null },
  };
  private listeners = new Set<Listener>();

  constructor() {
    window.addEventListener('hashchange', () => this.set({ screen: fromHash() }));
  }

  getState = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  navigate(screen: ScreenId) {
    if (location.hash !== `#/${screen}`) history.replaceState(null, '', `#/${screen}`);
    this.set({ screen });
  }

  setCaption(caption: DemoCaption | null) {
    this.set({ caption });
  }

  setPresentation(presentation: boolean) {
    this.set({ presentation });
  }

  setRotation(rotation: UiState['rotation']) {
    this.set({ rotation });
  }

  private set(patch: Partial<UiState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}

export const uiStore = new UiStore();

export function useUi(): UiState {
  return useSyncExternalStore(uiStore.subscribe, uiStore.getState);
}
