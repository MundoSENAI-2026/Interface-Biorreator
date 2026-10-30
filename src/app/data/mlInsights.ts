/**
 * Saída do modelo de Machine Learning (hoje: valores de exemplo para a demonstração).
 * Ao integrar o modelo real, substitua por uma chamada à API do modelo.
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
    {
      name: 'Vibração do motor do agitador (M-01)',
      contribution: 0.42,
      detail: 'Vibração RMS 15 % acima da média dos últimos 30 dias.',
    },
    {
      name: 'Padrão de abertura da XV-03',
      contribution: 0.31,
      detail: 'Tempo de curso 0,4 s acima do nominal em 6 das últimas 40 manobras.',
    },
    {
      name: 'Resfriamento pós-esterilização',
      contribution: 0.17,
      detail: 'Resfriamento 4 min mais lento que o lote de ouro nos últimos 3 lotes.',
    },
    {
      name: 'Deriva do sensor de pH (AIT_100_01)',
      contribution: 0.1,
      detail: 'Deriva de 0,08 pH desde a última calibração.',
    },
  ],
  recommendations: [
    'Inspecionar a válvula XV-03 (entrada de meio de cultura): verificar atuador e posicionador, pois o padrão de abertura está irregular.',
    'Monitorar a temperatura no início do resfriamento e verificar a vazão de água na camisa do tanque.',
    'Calibrar o sensor de pH AIT_100_01 com soluções-tampão 4,00 e 7,00 antes do próximo lote.',
    'Programar análise de vibração do motor M-01 na próxima parada.',
  ],
};
