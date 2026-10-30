import { EQUIPMENT, INTERLOCKS, TAGS, VALVE_BY_ID } from '../config/plant';
import { formatWithUnit } from '../lib/format';
import type { Command, PlcSnapshot } from './types';

const fmtTag = (tag: keyof typeof TAGS, v: number) =>
  formatWithUnit(v, TAGS[tag].decimals, TAGS[tag].unit);

/**
 * Tipo do bloqueio: 'shared' = vale para todos os comandos manuais (exibido uma vez no painel);
 * 'state' = o equipamento já está no estado pedido (botão só desabilitado);
 * 'interlock' = intertravamento de segurança (motivo exibido junto ao botão).
 */
export interface Block {
  message: string;
  kind: 'shared' | 'state' | 'interlock';
}

const shared = (message: string): Block => ({ message, kind: 'shared' });
const state = (message: string): Block => ({ message, kind: 'state' });
const interlock = (message: string): Block => ({ message, kind: 'interlock' });

/** Motivo comum que bloqueia TODOS os comandos manuais (ou null). */
export function manualBlockReason(s: PlcSnapshot | null, commOnline: boolean): string | null {
  if (!commOnline || !s) return 'Sem comunicação com o CLP';
  if (s.batch.status === 'emergency') return 'Parada de emergência ativa: rearme antes de operar';
  if (s.batch.status === 'running') return 'Processo em automático: pressione STOP para comandar manualmente';
  return null;
}

/**
 * Intertravamentos: devolve o motivo do bloqueio ou null se o comando é permitido.
 * Usado pela IHM (para mostrar o motivo) e pelo simulador (que recusa o comando),
 * como faria o CLP real.
 */
export function blockReason(cmd: Command, s: PlcSnapshot | null, commOnline: boolean): Block | null {
  if (!commOnline || !s) return shared('Sem comunicação com o CLP');

  const { status } = s.batch;
  if (cmd.type === 'emergency') return null;
  if (cmd.type === 'resetEmergency') {
    return status === 'emergency' ? null : state('Não há parada de emergência ativa');
  }
  if (status === 'emergency') return shared('Parada de emergência ativa: rearme antes de operar');

  if (cmd.type === 'start') {
    if (status === 'running') return state('O processo já está em execução');
    if (s.manwayOpen) return interlock(`${EQUIPMENT.manway.name} aberta: feche antes de iniciar`);
    return null;
  }
  if (cmd.type === 'stop') {
    return status === 'running' ? null : state('O processo não está em execução');
  }

  // Comandos manuais só com a sequência automática parada
  const manual = manualBlockReason(s, commOnline);
  if (manual) return shared(manual);

  const pressure = s.tags.PIT_100_01;
  const temperature = s.tags.TIT_100_01;

  switch (cmd.type) {
    case 'valve': {
      const current = s.valves[cmd.id];
      const v = VALVE_BY_ID[cmd.id];
      if (current === 'fault') return interlock(`${v.short} em falha: acionar a manutenção`);
      if (current === 'transition') return state(`${v.short} em transição`);
      if (cmd.open && current === 'open') return state(`${v.short} já está aberta`);
      if (!cmd.open && current === 'closed') return state(`${v.short} já está fechada`);
      if (!cmd.open && cmd.id === INTERLOCKS.pumpRequiresValve && s.pumpOn) {
        return interlock(`Desligue a ${EQUIPMENT.pump.name.toLowerCase()} (${EQUIPMENT.pump.short}) antes de fechar ${v.short}`);
      }
      return null;
    }
    case 'pump': {
      if (cmd.on === s.pumpOn) return state(cmd.on ? 'A bomba já está ligada' : 'A bomba já está desligada');
      if (cmd.on && s.valves[INTERLOCKS.pumpRequiresValve] !== 'open') {
        const v = VALVE_BY_ID[INTERLOCKS.pumpRequiresValve];
        return interlock(`Abra a válvula de ${v.function.toLowerCase()} ${v.short} antes de ligar a bomba`);
      }
      return null;
    }
    case 'motor': {
      if (cmd.on === s.motorOn) return state(cmd.on ? 'O agitador já está ligado' : 'O agitador já está desligado');
      if (cmd.on && s.manwayOpen) return interlock(`${EQUIPMENT.manway.name} aberta: feche antes de ligar o agitador`);
      if (cmd.on && s.tags.LIT_100_01 < INTERLOCKS.motorMinLevel) {
        return interlock(`Nível abaixo de ${fmtTag('LIT_100_01', INTERLOCKS.motorMinLevel)}: o agitador não pode operar a seco`);
      }
      return null;
    }
    case 'manway': {
      if (cmd.open === s.manwayOpen) return state(cmd.open ? 'A porta já está aberta' : 'A porta já está fechada');
      if (cmd.open) {
        if (pressure > INTERLOCKS.manwayMaxPressure) {
          return interlock(`Pressão de ${fmtTag('PIT_100_01', pressure)} no tanque: alivie a pressão pela exaustão (XV-08) antes de abrir`);
        }
        if (temperature > INTERLOCKS.manwayMaxTemperature) {
          return interlock(`Temperatura acima de ${fmtTag('TIT_100_01', INTERLOCKS.manwayMaxTemperature)}: aguarde o resfriamento`);
        }
        if (s.motorOn) return interlock('Desligue o agitador antes de abrir a porta');
      }
      return null;
    }
  }
}
