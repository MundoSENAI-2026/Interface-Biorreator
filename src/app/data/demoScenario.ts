import { PHASES } from '../config/plant';
import { plantStore, simulation } from './source';
import { uiStore, type ScreenId } from './ui';

/**
 * Cenário roteirizado de demonstração (~2 min), executado sobre o simulador:
 * processo normal → alerta → crítico → reconhecimento → intertravamento → normalização.
 * Os comandos passam pelo store, então ficam registrados no histórico como ações do operador.
 */

interface Step {
  at: number; // segundos desde o início
  text?: string;
  screen?: ScreenId;
  run?: () => void;
}

const FERMENTATION = PHASES.findIndex((p) => p.id === 'fermentacao');
const TOTAL_STEPS = 6;

const STEPS: Step[] = [
  {
    at: 0,
    screen: 'overview',
    text: 'Processo normal: fermentação a 37 °C, todas as variáveis dentro dos limites da etapa.',
    run: () => {
      simulation?.setAcceleration(10);
      simulation?.resetToPhase(FERMENTATION, 60);
    },
  },
  { at: 20, text: 'A temperatura sobe e ultrapassa o limite de alerta (39 °C): alarme de prioridade alta.', run: () => simulation?.force('TIT_100_01', 'warning') },
  { at: 45, text: 'A temperatura passa do limite crítico (41 °C): alarme crítico e status geral “Crítico”.', run: () => simulation?.force('TIT_100_01', 'critical') },
  { at: 65, screen: 'alarms', text: 'O operador reconhece os alarmes (ISA-18.2). Tudo fica registrado no histórico.' },
  { at: 70, run: () => plantStore.acknowledgeAll() },
  {
    at: 80,
    screen: 'overview',
    text: 'O operador para o processo e tenta abrir a porta de visita: o intertravamento bloqueia, pois o tanque está pressurizado.',
    run: () => void plantStore.send({ type: 'stop' }),
  },
  { at: 86, run: () => void plantStore.send({ type: 'manway', open: true }) },
  {
    at: 100,
    text: 'A temperatura volta ao normal e o processo retoma o modo automático.',
    run: () => {
      simulation?.force('TIT_100_01', 'normal');
      void plantStore.send({ type: 'start' });
    },
  },
  { at: 112, run: () => plantStore.acknowledgeAll() },
  { at: 120 },
];

class DemoScenario {
  private timers: ReturnType<typeof setTimeout>[] = [];
  private previousAcceleration = 0;

  get running() {
    return uiStore.getState().caption !== null;
  }

  start() {
    if (!simulation) return;
    this.stop();
    this.previousAcceleration = simulation.acceleration;
    let step = 0;
    for (const s of STEPS) {
      if (s.text) step += 1;
      const stepNumber = step;
      this.timers.push(
        setTimeout(() => {
          if (s.screen) uiStore.navigate(s.screen);
          s.run?.();
          if (s.text) uiStore.setCaption({ step: stepNumber, total: TOTAL_STEPS, text: s.text });
          if (s === STEPS[STEPS.length - 1]) this.finish();
        }, s.at * 1000),
      );
    }
  }

  stop() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    if (this.running) this.finish();
  }

  private finish() {
    simulation?.force('TIT_100_01', 'normal');
    if (this.previousAcceleration) simulation?.setAcceleration(this.previousAcceleration);
    uiStore.setCaption(null);
  }
}

export const demoScenario = new DemoScenario();
