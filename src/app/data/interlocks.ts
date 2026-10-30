import { EQUIPMENT, INTERLOCKS, TAGS, VALVE_BY_ID } from '../config/plant';
import { formatWithUnit } from '../lib/format';
import type { Command, PlcSnapshot } from './types';

const fmtTag = (tag: keyof typeof TAGS, v: number) =>
  formatWithUnit(v, TAGS[tag].decimals, TAGS[tag].unit);

/**
 * Intertravamentos: devolve o motivo do bloqueio ou null se o comando é permitido.
 * Usado pela IHM (para mostrar o motivo) e pelo simulador (que recusa o comando),
 * como faria o CLP real.
 */
export function blockReason(cmd: Command, s: PlcSnapshot | null, commOnline: boolean): string | null {
  if (!commOnline || !s) return 'Sem comunicação com o CLP';

  const { status } = s.batch;
  if (cmd.type === 'emergency') return null;
  if (cmd.type === 'resetEmergency') {
    return status === 'emergency' ? null : 'Não há parada de emergência ativa';
  }
  if (status === 'emergency') return 'Parada de emergência ativa: rearme antes de operar';

  if (cmd.type === 'start') {
    if (status === 'running') return 'O processo já está em execução';
    if (s.manwayOpen) return `${EQUIPMENT.manway.name} aberta: feche antes de iniciar`;
    return null;
  }
  if (cmd.type === 'stop') {
    return status === 'running' ? null : 'O processo não está em execução';
  }

  // Comandos manuais só com a sequência automática parada
  if (status === 'running') {
    return 'Processo em automático: pressione STOP para comandar manualmente';
  }

  const pressure = s.tags.PIT_100_01;
  const temperature = s.tags.TIT_100_01;

  switch (cmd.type) {
    case 'valve': {
      const state = s.valves[cmd.id];
      const v = VALVE_BY_ID[cmd.id];
      if (state === 'fault') return `${v.short} em falha: acionar a manutenção`;
      if (state === 'transition') return `${v.short} em transição`;
      if (cmd.open && state === 'open') return `${v.short} já está aberta`;
      if (!cmd.open && state === 'closed') return `${v.short} já está fechada`;
      if (!cmd.open && cmd.id === INTERLOCKS.pumpRequiresValve && s.pumpOn) {
        return `Desligue a ${EQUIPMENT.pump.name.toLowerCase()} (${EQUIPMENT.pump.short}) antes de fechar ${v.short}`;
      }
      return null;
    }
    case 'pump': {
      if (cmd.on === s.pumpOn) return cmd.on ? 'A bomba já está ligada' : 'A bomba já está desligada';
      if (cmd.on && s.valves[INTERLOCKS.pumpRequiresValve] !== 'open') {
        const v = VALVE_BY_ID[INTERLOCKS.pumpRequiresValve];
        return `Abra a válvula de ${v.function.toLowerCase()} ${v.short} antes de ligar a bomba`;
      }
      return null;
    }
    case 'motor': {
      if (cmd.on === s.motorOn) return cmd.on ? 'O agitador já está ligado' : 'O agitador já está desligado';
      if (cmd.on && s.manwayOpen) return `${EQUIPMENT.manway.name} aberta: feche antes de ligar o agitador`;
      if (cmd.on && s.tags.LIT_100_01 < INTERLOCKS.motorMinLevel) {
        return `Nível abaixo de ${fmtTag('LIT_100_01', INTERLOCKS.motorMinLevel)}: o agitador não pode operar a seco`;
      }
      return null;
    }
    case 'manway': {
      if (cmd.open === s.manwayOpen) return cmd.open ? 'A porta já está aberta' : 'A porta já está fechada';
      if (cmd.open) {
        if (pressure > INTERLOCKS.manwayMaxPressure) {
          return `Pressão de ${fmtTag('PIT_100_01', pressure)} no tanque: alivie a pressão pela exaustão (XV-08) antes de abrir`;
        }
        if (temperature > INTERLOCKS.manwayMaxTemperature) {
          return `Temperatura acima de ${fmtTag('TIT_100_01', INTERLOCKS.manwayMaxTemperature)}: aguarde o resfriamento`;
        }
        if (s.motorOn) return 'Desligue o agitador antes de abrir a porta';
      }
      return null;
    }
  }
}
