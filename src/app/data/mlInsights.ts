import { MAINTENANCE } from '../config/plant';

/**
 * Saída do modelo de Machine Learning e dados de manutenção (hoje: valores de
 * exemplo, determinísticos, para a demonstração). Ao integrar o modelo real e o
 * sistema de manutenção, substitua por chamadas às respectivas APIs.
 */
export interface FailureFactor {
  name: string;
  /** Participação no risco (0–1). */
  contribution: number;
  detail: string;
}

export interface MlInsights {
  failureProbability: number;
  horizonDays: number;
  factors: FailureFactor[];
  recommendations: string[];
}

export const ML_INSIGHTS: MlInsights = {
  failureProbability: 0.123,
  horizonDays: 30,
  factors: [
    { name: 'Vibração do motor M-01', contribution: 0.42, detail: 'RMS 15 % acima da média de 30 dias' },
    { name: 'Abertura irregular da XV-03', contribution: 0.31, detail: 'Curso 0,4 s acima do nominal em 6 de 40 manobras' },
    { name: 'Resfriamento pós-esterilização', contribution: 0.17, detail: '4 min mais lento que o lote de ouro (3 lotes)' },
    { name: 'Deriva do pH (AIT_100_01)', contribution: 0.1, detail: '0,08 pH desde a última calibração' },
  ],
  recommendations: [
    'Inspecionar o atuador e o posicionador da XV-03 (entrada de meio de cultura).',
    'Verificar a vazão de água na camisa no início do resfriamento.',
    'Calibrar o AIT_100_01 com tampões 4,00 e 7,00 antes do próximo lote.',
    'Programar análise de vibração do M-01 na próxima parada.',
  ],
};

// ─── Séries dos últimos 30 dias (determinísticas) ─────────────────────────

const DAY_MS = 86_400_000;

/** Ruído determinístico em [-1, 1] (mesmo valor a cada recarga). */
const wobble = (i: number, k: number) => Math.sin(i * k) * 0.6 + Math.sin(i * k * 2.3 + 1) * 0.4;

export interface DailyPoint {
  t: number;
  v: number;
}

function lastDays(today: Date, days: number, f: (i: number, n: number) => number): DailyPoint[] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Array.from({ length: days }, (_, i) => ({ t: end - (days - 1 - i) * DAY_MS, v: f(i, days) }));
}

/** Probabilidade de falha estimada pelo modelo, dia a dia, terminando no valor atual. */
export function probabilityHistory(today: Date): DailyPoint[] {
  const p = ML_INSIGHTS.failureProbability;
  return lastDays(today, 30, (i, n) => (i === n - 1 ? p : 0.055 + (p - 0.055) * (i / (n - 1)) ** 1.6 + 0.008 * wobble(i, 1.1)));
}

/** Limite de vibração RMS do M-01 (mm/s) — ajustar à norma/fabricante. */
export const VIBRATION_LIMIT_MM_S = 4.5;

/** Vibração RMS do motor M-01 (mm/s), média diária. */
export function vibrationHistory(today: Date): DailyPoint[] {
  return lastDays(today, 30, (i, n) => 2.2 + 1.25 * (i / (n - 1)) ** 1.8 + 0.18 * wobble(i, 0.9));
}

// ─── Saúde dos ativos ──────────────────────────────────────────────────────

export interface AssetHealth {
  id: string;
  name: string;
  type: 'Motor' | 'Bomba' | 'Válvula' | 'Sensor';
  /** Índice de saúde 0–100. */
  health: number;
  /** Uso: horas de operação (motor/bomba) ou nº de manobras (válvulas) ou dias desde a calibração (sensores). */
  usage: string;
  lastMaintenance: string; // AAAA-MM-DD
}

const valve = (n: string, health: number, cycles: number, last: string): AssetHealth => ({
  id: `XV_100_${n}`, name: `XV-${n}`, type: 'Válvula', health, usage: `${cycles.toLocaleString('pt-BR')} manobras`, lastMaintenance: last,
});

export const ASSETS: AssetHealth[] = [
  { id: 'M_100_01', name: 'M-01 agitador', type: 'Motor', health: 64, usage: '1.240 h', lastMaintenance: '2026-05-20' },
  { id: 'P_100_01', name: 'P-01 transferência', type: 'Bomba', health: 86, usage: '310 h', lastMaintenance: '2026-07-14' },
  valve('01', 91, 1420, '2026-06-02'),
  valve('02', 93, 380, '2026-06-02'),
  valve('03', 57, 1870, '2026-03-11'),
  valve('04', 95, 210, '2026-06-02'),
  valve('05', 84, 960, '2026-06-02'),
  valve('06', 82, 610, '2026-07-14'),
  valve('07', 88, 590, '2026-07-14'),
  valve('08', 79, 2310, '2026-04-28'),
  valve('09', 94, 240, '2026-06-02'),
  valve('10', 90, 330, '2026-07-14'),
  { id: 'TIT_100_01', name: 'TIT 100-01', type: 'Sensor', health: 92, usage: '48 dias sem calibração', lastMaintenance: '2026-09-12' },
  { id: 'PIT_100_01', name: 'PIT 100-01', type: 'Sensor', health: 90, usage: '48 dias sem calibração', lastMaintenance: '2026-09-12' },
  { id: 'LIT_100_01', name: 'LIT 100-01', type: 'Sensor', health: 88, usage: '81 dias sem calibração', lastMaintenance: '2026-08-10' },
  { id: 'AIT_100_01', name: 'AIT 100-01', type: 'Sensor', health: 61, usage: '81 dias sem calibração', lastMaintenance: '2026-08-10' },
];

/** Índice de saúde: ≥ 75 bom, 50–74 atenção, < 50 crítico. */
export const HEALTH_WARN = 75;
export const HEALTH_CRIT = 50;

// ─── Plano de manutenção ───────────────────────────────────────────────────

export type TaskType = 'Preventiva' | 'Preditiva' | 'Calibração';

export interface MaintenanceTask {
  date: string; // AAAA-MM-DD
  asset: string;
  type: TaskType;
  description: string;
  owner: string;
}

export const MAINTENANCE_PLAN: MaintenanceTask[] = [
  { date: '2026-11-04', asset: 'AIT 100-01', type: 'Calibração', description: 'Calibração com tampões 4,00 / 7,00', owner: 'Instrumentação' },
  { date: '2026-11-09', asset: 'XV-03', type: 'Preditiva', description: 'Inspeção de atuador e posicionador', owner: 'Manutenção mecânica' },
  { date: MAINTENANCE.nextDate, asset: 'M-01', type: 'Preventiva', description: MAINTENANCE.description, owner: 'Manutenção mecânica' },
  { date: '2026-11-27', asset: 'P-01', type: 'Preventiva', description: 'Troca do selo e inspeção do rotor', owner: 'Manutenção mecânica' },
  { date: '2026-12-03', asset: 'TIT · PIT · LIT', type: 'Calibração', description: 'Calibração anual dos transmissores', owner: 'Instrumentação' },
];
