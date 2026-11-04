import { PHASES, SIMULATION, type TagId } from '../config/plant';

/**
 * Lote de ouro (golden batch): perfil de referência DETERMINÍSTICO por etapa.
 * Mesma entrada → mesma saída; usado pelo simulador e pelo gráfico de batelada.
 */

const AMBIENT = SIMULATION.ambientTemperature;
const STERILIZATION_T = 121;
const FERMENTATION_T = 37;
const HEAT_RAMP_MIN = 20;

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Pressão manométrica aproximada de vapor saturado (kgf/cm²) — 1,05 a 121 °C. */
function steamPressure(temperature: number): number {
  if (temperature <= 100) return 0;
  return 1.05 * Math.pow(clamp01((temperature - 100) / 21), 1.6);
}

function temperature(phase: number, t: number): number {
  switch (PHASES[phase].id) {
    case 'esterilizacao': {
      const x = clamp01(t / HEAT_RAMP_MIN);
      return AMBIENT + (STERILIZATION_T - AMBIENT) * (1 - (1 - x) ** 2);
    }
    case 'resfriamento':
      return FERMENTATION_T + (STERILIZATION_T - FERMENTATION_T) * Math.exp(-t / 7);
    case 'cultura':
    case 'mistura':
    case 'microrganismo':
      return FERMENTATION_T;
    case 'fermentacao':
      // leve elevação pela atividade metabólica
      return FERMENTATION_T + 0.4 * Math.sin((Math.PI * t) / 480);
    case 'fim_producao':
      return FERMENTATION_T - 5 * (1 - Math.exp(-t / 8));
    default:
      return AMBIENT;
  }
}

function pressure(phase: number, t: number): number {
  switch (PHASES[phase].id) {
    case 'check_pressao':
      return 0.5 * (1 - Math.exp(-t / 0.7));
    case 'alivio_pressao':
      return 0.5 * Math.exp(-t / 0.6);
    case 'esterilizacao':
    case 'resfriamento':
      return steamPressure(temperature(phase, t));
    case 'fermentacao':
      return 0.15 * (1 - Math.exp(-t / 3));
    case 'fim_producao':
      return 0.15 * Math.exp(-t / 2);
    default:
      return 0;
  }
}

function level(phase: number, t: number): number {
  switch (PHASES[phase].id) {
    case 'abastecimento':
      return 65 * clamp01(t / 13);
    case 'cultura':
      return 65 + 5 * clamp01(t / 6);
    case 'mistura':
      return 70;
    case 'microrganismo':
      return 70 + 2 * clamp01(t / 3);
    case 'fermentacao':
      return 72 - t / 480;
    case 'fim_producao':
      return 71 * clamp01(1 - t / 16);
    default:
      return 65;
  }
}

function ph(phase: number, t: number): number {
  switch (PHASES[phase].id) {
    case 'microrganismo':
      return 7 - 0.05 * clamp01(t / 5);
    case 'fermentacao':
      return 6.95 - 0.25 * (1 - Math.exp(-t / 120));
    case 'fim_producao':
      return 6.95 - 0.25 * (1 - Math.exp(-4));
    default:
      return 7;
  }
}

const PROFILES: Record<TagId, (phase: number, t: number) => number> = {
  TIT_100_01: temperature,
  PIT_100_01: pressure,
  LIT_100_01: level,
  AIT_100_01: ph,
};

/** Valor de referência da tag na etapa `phase`, `tMin` minutos de processo após o início. */
export function goldenValue(tag: TagId, phase: number, tMin: number): number {
  return PROFILES[tag](phase, Math.max(0, tMin));
}

/** Curva completa da etapa para o gráfico. */
export function goldenCurve(tag: TagId, phase: number, points = 120): { tMin: number; v: number }[] {
  const duration = PHASES[phase].durationMin;
  return Array.from({ length: points + 1 }, (_, i) => {
    const tMin = (duration * i) / points;
    return { tMin, v: goldenValue(tag, phase, tMin) };
  });
}
