import { useSyncExternalStore } from 'react';
import { Simulator, type SimulationControls } from './simulator';
import { PlantStore, type PlantState } from './store';
import type { DataSource } from './types';

/**
 * Ponto único de troca da fonte de dados.
 * Para o CLP real, crie p.ex. `OpcUaSource implements DataSource` (via gateway
 * WebSocket/REST, já que o navegador não fala OPC UA diretamente) e retorne-o aqui.
 */
function createDataSource(): DataSource {
  return new Simulator();
}

export const dataSource = createDataSource();
export const plantStore = new PlantStore(dataSource);

/** Controles de simulação, disponíveis apenas quando a fonte é o simulador. */
export const simulation: SimulationControls | null =
  dataSource instanceof Simulator ? dataSource : null;

export function usePlant(): PlantState {
  return useSyncExternalStore(plantStore.subscribe, plantStore.getState);
}
