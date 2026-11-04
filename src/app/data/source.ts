import { useSyncExternalStore } from 'react';
import { DATA_SOURCE, type SourceKind } from '../config/plant';
import { PahoMqttSource } from './pahoMqttSource';
import { Simulator, type SimulationControls } from './simulator';
import { PlantStore, type PlantState } from './store';
import type { DataSource } from './types';

/** Chave do navegador onde fica a fonte escolhida no painel de simulação. */
const STORAGE_KEY = 'br100.fonteDeDados';

/** Fonte escolhida no painel (salva neste navegador) ou, se não houver, a do config. */
function readActiveSource(): SourceKind {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'simulacao' || saved === 'mqtt') return saved;
  } catch {
    // navegador sem armazenamento: usa o config
  }
  return DATA_SOURCE.active;
}

/**
 * Troca a fonte de dados e recarrega a página: o histórico, os alarmes e as
 * tendências recomeçam do zero com a nova fonte.
 */
export function setActiveSource(kind: SourceKind) {
  try {
    localStorage.setItem(STORAGE_KEY, kind);
  } catch {
    // sem armazenamento: a troca vale só até recarregar
  }
  window.location.reload();
}

/**
 * Ponto único de troca da fonte de dados (simulador ou MQTT; ver config/plant.ts).
 * Para o CLP via OPC UA, crie p.ex. `OpcUaSource implements DataSource` (via gateway
 * WebSocket/REST, já que o navegador não fala OPC UA diretamente) e retorne-o aqui.
 */
function createDataSource(kind: SourceKind): DataSource {
  return kind === 'mqtt' ? new PahoMqttSource() : new Simulator();
}

export const activeSource = readActiveSource();
export const dataSource = createDataSource(activeSource);
export const plantStore = new PlantStore(dataSource);

/** Controles de simulação, disponíveis apenas quando a fonte é o simulador. */
export const simulation: SimulationControls | null =
  dataSource instanceof Simulator ? dataSource : null;

/** Detalhes da conexão MQTT, disponíveis apenas quando a fonte é o MQTT. */
export const mqttSource: PahoMqttSource | null =
  dataSource instanceof PahoMqttSource ? dataSource : null;

export function usePlant(): PlantState {
  return useSyncExternalStore(plantStore.subscribe, plantStore.getState);
}
