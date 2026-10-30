import { EQUIPMENT, PHASES, PLANT, VALVES } from '../config/plant';
import type { AlarmKind, AlarmPriority, HistoryRecord, IsaPriority } from './types';

/**
 * Histórico inicial coerente para o simulador: o que o historiador do CLP teria
 * registrado desde o início do lote até agora (etapas, válvulas, equipamentos,
 * comandos e alguns alarmes já reconhecidos e normalizados).
 */

const SYSTEM_PROCESS = 'Sistema (CLP)';
const SYSTEM_ALARM = 'Sistema (alarme)';

interface SeedAlarm {
  phase: number;
  minute: number;
  source: string;
  kind: AlarmKind;
  priority: AlarmPriority;
  level: IsaPriority;
  message: string;
  ackAfterS: number;
  normalizeAfterS: number;
  /** Eventos de processo associados (ex.: perda/retorno de comunicação). */
  process?: [offsetS: number, message: string][];
}

const SEED_ALARMS: SeedAlarm[] = [
  {
    phase: 0, minute: 6, source: 'LIT_100_01', kind: 'L', priority: 'warning', level: 'baixa',
    message: 'Nível com desvio do lote de ouro (tolerância ±4,0 %)', ackAfterS: 90, normalizeAfterS: 150,
  },
  {
    phase: 1, minute: 2, source: 'XV_100_03', kind: 'FAULT', priority: 'warning', level: 'media',
    message: 'XV-03 (entrada) em falha — sem confirmação de posição', ackAfterS: 60, normalizeAfterS: 120,
  },
  {
    phase: 2, minute: 3, source: 'PIT_100_01', kind: 'H', priority: 'warning', level: 'alta',
    message: 'Pressão alta (limite 0,70 kgf/cm²)', ackAfterS: 40, normalizeAfterS: 70,
  },
  {
    phase: 3, minute: 1, source: 'CLP', kind: 'COMM', priority: 'critical', level: 'critica',
    message: 'Falha de comunicação com o CLP', ackAfterS: 25, normalizeAfterS: 12,
    process: [[-5, 'Comunicação com o CLP perdida (sem leitura há mais de 5 s)'], [12, 'Comunicação com o CLP restabelecida']],
  },
];

const phaseStartS = (phase: number) => PHASES.slice(0, phase).reduce((acc, p) => acc + p.durationMin * 60, 0);

export function seedHistory(startedAt: number, phaseIndex: number, phaseElapsedS: number, lot: string): HistoryRecord[] {
  const nowS = phaseStartS(phaseIndex) + phaseElapsedS;
  const at = (s: number) => startedAt + s * 1000;
  const out: HistoryRecord[] = [];
  const push = (s: number, r: Omit<HistoryRecord, 'time'>) => {
    if (s <= nowS) out.push({ ...r, time: at(s) });
  };

  push(0, { category: 'operator', action: 'Comando', source: 'Operador', message: 'START do processo', user: PLANT.operator });
  push(1, { category: 'process', action: 'Estado do processo', source: 'Sequência', message: `Novo lote ${lot} iniciado`, user: SYSTEM_PROCESS });
  push(1, { category: 'process', action: 'Estado do processo', source: 'Sequência', message: 'Sequência automática em execução', user: SYSTEM_PROCESS });

  // Etapas: mudança de etapa + válvulas e equipamentos comandados pela receita
  let prevOpen = new Set<string>();
  let prevMotor = false;
  let prevPump = false;
  for (let p = 0; p <= phaseIndex; p++) {
    const ph = PHASES[p];
    const t0 = phaseStartS(p) + 2;
    push(t0, { category: 'process', action: 'Mudança de etapa', source: 'Sequência', message: `Etapa ${p + 1}/${PHASES.length} · ${ph.name} iniciada`, user: SYSTEM_PROCESS });
    const open = new Set<string>(ph.valvesOpen);
    for (const v of VALVES) {
      if (open.has(v.id) !== prevOpen.has(v.id)) {
        push(t0 + 2, {
          category: 'process', action: 'Válvula', source: v.id, user: SYSTEM_PROCESS,
          message: `${v.short} (${v.function.toLowerCase()}) ${open.has(v.id) ? 'aberta' : 'fechada'}`,
        });
      }
    }
    if (ph.motor !== prevMotor) {
      push(t0 + 3, { category: 'process', action: 'Equipamento', source: EQUIPMENT.motor.id, user: SYSTEM_PROCESS, message: `${EQUIPMENT.motor.name} ${ph.motor ? 'ligado' : 'desligado'}` });
    }
    if (ph.pump !== prevPump) {
      push(t0 + 3, { category: 'process', action: 'Equipamento', source: EQUIPMENT.pump.id, user: SYSTEM_PROCESS, message: `${EQUIPMENT.pump.name} ${ph.pump ? 'ligada' : 'desligada'}` });
    }
    prevOpen = open;
    prevMotor = ph.motor;
    prevPump = ph.pump;
  }

  // Alarmes já tratados: ativação → reconhecimento pelo operador → normalização
  for (const a of SEED_ALARMS) {
    // Communication loss is only logged when triggered by simulation or scenario.
    if (a.kind === 'COMM') continue;
    const t = phaseStartS(a.phase) + a.minute * 60;
    const alarmId = `${a.source}:${a.kind}`;
    const base = { source: a.source, priority: a.priority, level: a.level, alarmId };
    for (const [offset, message] of a.process ?? []) {
      push(t + offset, { category: 'process', action: 'Comunicação', source: 'CLP', message, user: SYSTEM_PROCESS });
    }
    push(t, { ...base, category: 'alarm', action: 'Ativado', message: a.message, user: SYSTEM_ALARM });
    push(t + a.ackAfterS, { ...base, category: 'operator', action: 'Reconhecimento', message: `Reconheceu alarme: ${a.message}`, user: PLANT.operator });
    push(t + a.normalizeAfterS, { ...base, category: 'alarm', action: 'Normalizado', message: a.message, user: SYSTEM_ALARM });
  }

  return out;
}
