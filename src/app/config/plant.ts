/**
 * Configuração da planta BR-100.
 *
 * Tudo que depende do processo/CLP fica aqui: tags, unidades, casas decimais,
 * faixas, limites POR ETAPA, válvulas, intertravamentos, manutenção e simulação.
 * Ao conectar ao CLP real, ajuste este arquivo e o DataSource em src/app/data.
 */

// ─── Identificação ──────────────────────────────────────────────────────────

export const PLANT = {
  systemName: 'Supervisório do Biorreator',
  equipmentId: 'BR-100',
  equipmentName: 'Biorreator BR-100',
  operator: 'Operador 01',
  /** Prefixo do código de lote; o sufixo é a data de início (AAAAMMDD). */
  batchPrefix: 'L-BR100',
} as const;

/** Tempo sem leitura do CLP para considerar a comunicação perdida. */
export const COMM_TIMEOUT_MS = 5_000;

/** Janela das mini-tendências nos cards (tempo real). */
export const TREND_WINDOW_S = 5 * 60;

/** Histórico em memória para a tela de Tendências (tempo real). */
export const HISTORY_WINDOW_S = 30 * 60;

/** Períodos selecionáveis na tela de Tendências (s); 'phase' = etapa atual × lote de ouro. */
export const TREND_PERIODS: { id: 'phase' | number; label: string }[] = [
  { id: 'phase', label: 'Etapa atual' },
  { id: 5 * 60, label: '5 min' },
  { id: 15 * 60, label: '15 min' },
  { id: 30 * 60, label: '30 min' },
];

/** Número máximo de notificações visíveis ao mesmo tempo. */
export const MAX_VISIBLE_TOASTS = 3;

// ─── Variáveis de processo (tags analógicas) ───────────────────────────────

export type TagId = 'TIT_100_01' | 'LIT_100_01' | 'PIT_100_01' | 'AIT_100_01';

export interface TagConfig {
  id: TagId;
  /** Tag no formato ISA para exibição no sinótico (ex.: TIT 100-01). */
  isa: string;
  name: string;
  unit: string;
  decimals: number;
  /** Escala de engenharia fixa (valores redondos): 0–150 °C, 0–100 %, 0–2 kgf/cm², 0–14 pH. */
  rangeMin: number;
  rangeMax: number;
  /**
   * Passo "redondo" do zoom da barra de faixas: quando os limites da etapa ocupam
   * pouco da escala, a barra mostra só a faixa da etapa, com extremos múltiplos deste passo.
   */
  zoomStep: number;
  /** Histerese para normalizar um alarme (evita alarmes "piscando"). */
  deadband: number;
  /** Variação mínima por minuto para mostrar seta de tendência. */
  trendThresholdPerMin: number;
}

export const TAGS: Record<TagId, TagConfig> = {
  TIT_100_01: {
    id: 'TIT_100_01', isa: 'TIT 100-01', name: 'Temperatura', unit: '°C',
    decimals: 1, rangeMin: 0, rangeMax: 150, zoomStep: 5, deadband: 0.5, trendThresholdPerMin: 0.3,
  },
  LIT_100_01: {
    id: 'LIT_100_01', isa: 'LIT 100-01', name: 'Nível', unit: '%',
    decimals: 1, rangeMin: 0, rangeMax: 100, zoomStep: 10, deadband: 1, trendThresholdPerMin: 0.5,
  },
  PIT_100_01: {
    id: 'PIT_100_01', isa: 'PIT 100-01', name: 'Pressão', unit: 'kgf/cm²',
    decimals: 2, rangeMin: 0, rangeMax: 2, zoomStep: 0.1, deadband: 0.03, trendThresholdPerMin: 0.02,
  },
  AIT_100_01: {
    id: 'AIT_100_01', isa: 'AIT 100-01', name: 'pH', unit: 'pH',
    decimals: 2, rangeMin: 0, rangeMax: 14, zoomStep: 0.5, deadband: 0.05, trendThresholdPerMin: 0.02,
  },
};

export const TAG_ORDER: TagId[] = ['TIT_100_01', 'PIT_100_01', 'LIT_100_01', 'AIT_100_01'];

// ─── Limites por etapa ──────────────────────────────────────────────────────

export interface TagLimits {
  setpoint: number;
  /** Faixa de tolerância em torno do lote de ouro (± valor). */
  tolerance: number;
  warnLo?: number;
  warnHi?: number;
  critLo?: number;
  critHi?: number;
  /**
   * Limites baixos só são armados depois que a variável atinge o setpoint
   * na etapa (alarme por estado — evita alarme falso durante rampa).
   */
  armLowAfterSetpoint?: boolean;
}

/** Limites padrão, usados quando a etapa não define os seus. */
const DEFAULT_LIMITS: Record<TagId, TagLimits> = {
  TIT_100_01: { setpoint: 25, tolerance: 3, warnHi: 45, critHi: 55 },
  LIT_100_01: { setpoint: 65, tolerance: 4, warnHi: 85, critHi: 92 },
  PIT_100_01: { setpoint: 0, tolerance: 0.1, warnHi: 0.3, critHi: 0.5 },
  AIT_100_01: { setpoint: 7, tolerance: 0.3, warnLo: 5.5, warnHi: 8.5, critLo: 5, critHi: 9 },
};

// ─── Etapas do processo (sequência da IHM) ─────────────────────────────────

export type ValveId =
  | 'XV_100_01' | 'XV_100_02' | 'XV_100_03' | 'XV_100_04' | 'XV_100_05'
  | 'XV_100_06' | 'XV_100_07' | 'XV_100_08' | 'XV_100_09' | 'XV_100_10';

export type PhaseId =
  | 'abastecimento' | 'agitacao' | 'check_pressao' | 'alivio_pressao' | 'esterilizacao'
  | 'resfriamento' | 'cultura' | 'mistura' | 'microrganismo' | 'fermentacao' | 'fim_producao';

export interface PhaseConfig {
  id: PhaseId;
  name: string;
  /** Duração nominal em tempo de processo (minutos). */
  durationMin: number;
  /** Variável principal mostrada no gráfico de batelada. */
  primaryTag: TagId;
  limits: Partial<Record<TagId, Partial<TagLimits>>>;
  /** Estado dos equipamentos comandado pela sequência automática. */
  valvesOpen: ValveId[];
  motor: boolean;
  pump: boolean;
}

export const PHASES: PhaseConfig[] = [
  {
    id: 'abastecimento', name: 'Abastecimento', durationMin: 15, primaryTag: 'LIT_100_01',
    limits: { LIT_100_01: { setpoint: 65 } },
    valvesOpen: ['XV_100_01', 'XV_100_08'], motor: false, pump: false,
  },
  {
    id: 'agitacao', name: 'Agitação', durationMin: 5, primaryTag: 'LIT_100_01',
    limits: { LIT_100_01: { setpoint: 65, warnLo: 55, critLo: 45 } },
    valvesOpen: [], motor: true, pump: false,
  },
  {
    id: 'check_pressao', name: 'Check Pressão', durationMin: 6, primaryTag: 'PIT_100_01',
    limits: {
      PIT_100_01: {
        setpoint: 0.5, tolerance: 0.08, warnLo: 0.4, warnHi: 0.7, critLo: 0.3, critHi: 0.9,
        armLowAfterSetpoint: true,
      },
    },
    valvesOpen: ['XV_100_05'], motor: false, pump: false,
  },
  {
    id: 'alivio_pressao', name: 'Alívio Pressão', durationMin: 4, primaryTag: 'PIT_100_01',
    limits: { PIT_100_01: { setpoint: 0, tolerance: 0.1, warnHi: 0.7, critHi: 0.9 } },
    valvesOpen: ['XV_100_08'], motor: false, pump: false,
  },
  {
    id: 'esterilizacao', name: 'Esterilização', durationMin: 50, primaryTag: 'TIT_100_01',
    limits: {
      TIT_100_01: {
        setpoint: 121, tolerance: 2, warnLo: 119, warnHi: 124, critLo: 117, critHi: 127,
        armLowAfterSetpoint: true,
      },
      // Pressão de vapor saturado a 121 °C ≈ 1,05 kgf/cm² (manométrica): é o normal
      PIT_100_01: {
        setpoint: 1.05, tolerance: 0.1, warnLo: 0.9, warnHi: 1.25, critLo: 0.8, critHi: 1.4,
        armLowAfterSetpoint: true,
      },
    },
    valvesOpen: ['XV_100_06'], motor: true, pump: false,
  },
  {
    id: 'resfriamento', name: 'Resfriamento', durationMin: 35, primaryTag: 'TIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 37, tolerance: 4, warnHi: 125, critHi: 128 },
      PIT_100_01: { setpoint: 0, tolerance: 0.15, warnHi: 1.25, critHi: 1.4 },
    },
    valvesOpen: ['XV_100_07', 'XV_100_08'], motor: true, pump: false,
  },
  {
    id: 'cultura', name: 'Cultura', durationMin: 8, primaryTag: 'LIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 37, tolerance: 1.5, warnLo: 34, warnHi: 40, critLo: 30, critHi: 45 },
      LIT_100_01: { setpoint: 70 },
    },
    valvesOpen: ['XV_100_03', 'XV_100_08'], motor: false, pump: false,
  },
  {
    id: 'mistura', name: 'Mistura', durationMin: 8, primaryTag: 'TIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 37, tolerance: 1.5, warnLo: 34, warnHi: 40, critLo: 30, critHi: 45 },
      LIT_100_01: { setpoint: 70 },
    },
    valvesOpen: [], motor: true, pump: false,
  },
  {
    id: 'microrganismo', name: 'Microrganismo', durationMin: 5, primaryTag: 'TIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 37, tolerance: 1.5, warnLo: 34, warnHi: 40, critLo: 30, critHi: 45 },
      LIT_100_01: { setpoint: 72 },
    },
    valvesOpen: ['XV_100_09', 'XV_100_08'], motor: true, pump: false,
  },
  {
    id: 'fermentacao', name: 'Fermentação', durationMin: 480, primaryTag: 'TIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 37, tolerance: 1, warnLo: 35, warnHi: 39, critLo: 33, critHi: 41 },
      PIT_100_01: { setpoint: 0.15, tolerance: 0.08, warnHi: 0.35, critHi: 0.5 },
      LIT_100_01: { setpoint: 71, warnLo: 55, critLo: 45 },
      AIT_100_01: { setpoint: 6.8, tolerance: 0.2, warnLo: 6.2, warnHi: 7.4, critLo: 5.8, critHi: 7.8 },
    },
    valvesOpen: ['XV_100_05', 'XV_100_08'], motor: true, pump: false,
  },
  {
    id: 'fim_producao', name: 'Fim Produção', durationMin: 20, primaryTag: 'LIT_100_01',
    limits: {
      TIT_100_01: { setpoint: 32, tolerance: 4, warnHi: 42, critHi: 48 },
      LIT_100_01: { setpoint: 0, tolerance: 6 },
    },
    valvesOpen: ['XV_100_10', 'XV_100_08'], motor: false, pump: true,
  },
];

/** Etapa nas mensagens: "etapa 3 (Check Pressão)" (minúscula; quem começa a frase capitaliza). */
export function phaseLabel(phaseIndex: number): string {
  return `etapa ${phaseIndex + 1} (${PHASES[phaseIndex].name})`;
}

export function getLimits(tag: TagId, phaseIndex: number): TagLimits {
  const phase = PHASES[phaseIndex];
  return { ...DEFAULT_LIMITS[tag], ...(phase?.limits[tag] ?? {}) };
}

// ─── Válvulas e equipamentos ───────────────────────────────────────────────

export type ValveFunction =
  | 'Entrada' | 'Saída' | 'Aeração' | 'Exaustão' | 'Transferência' | 'Vapor' | 'Resfriamento';

export interface ValveConfig {
  id: ValveId;
  short: string;
  function: ValveFunction;
  description: string;
  /** Pede confirmação antes de comandar. */
  confirm: boolean;
}

export const VALVES: ValveConfig[] = [
  { id: 'XV_100_01', short: 'XV-01', function: 'Entrada', description: 'Entrada de meio/água', confirm: false },
  { id: 'XV_100_02', short: 'XV-02', function: 'Saída', description: 'Saída / dreno de fundo', confirm: true },
  { id: 'XV_100_03', short: 'XV-03', function: 'Entrada', description: 'Entrada de meio de cultura', confirm: false },
  { id: 'XV_100_04', short: 'XV-04', function: 'Saída', description: 'Saída para amostragem', confirm: true },
  { id: 'XV_100_05', short: 'XV-05', function: 'Aeração', description: 'Entrada de ar estéril (aspersor)', confirm: false },
  // XV-06 e XV-07: funções provisórias (a IHM de referência não as define) — ajuste aqui
  { id: 'XV_100_06', short: 'XV-06', function: 'Vapor', description: 'Vapor – esterilização (camisa)', confirm: true },
  { id: 'XV_100_07', short: 'XV-07', function: 'Resfriamento', description: 'Água de resfriamento – camisa', confirm: false },
  { id: 'XV_100_08', short: 'XV-08', function: 'Exaustão', description: 'Exaustão / alívio de gases', confirm: false },
  { id: 'XV_100_09', short: 'XV-09', function: 'Entrada', description: 'Entrada de inóculo (microrganismo)', confirm: false },
  { id: 'XV_100_10', short: 'XV-10', function: 'Transferência', description: 'Transferência do produto', confirm: true },
];

export const VALVE_BY_ID = Object.fromEntries(VALVES.map((v) => [v.id, v])) as Record<ValveId, ValveConfig>;

export const EQUIPMENT = {
  motor: { id: 'M_100_01', short: 'M-01', name: 'Motor do agitador', ratedRpm: 120 },
  pump: { id: 'P_100_01', short: 'P-01', name: 'Bomba de transferência' },
  manway: { id: 'ZS_100_01', short: 'ZS-01', name: 'Porta de visita' },
} as const;

/** Tempo de curso de abertura/fechamento das válvulas (simulação). */
export const VALVE_STROKE_MS = 1_500;

// ─── Intertravamentos ──────────────────────────────────────────────────────

export const INTERLOCKS = {
  /** Pressão acima da qual a porta de visita não pode ser aberta. */
  manwayMaxPressure: 0.05,
  /** Temperatura acima da qual a porta de visita não pode ser aberta. */
  manwayMaxTemperature: 50,
  /** Nível mínimo para ligar o agitador (impelidor submerso). */
  motorMinLevel: 20,
  /** Válvula que precisa estar aberta para ligar a bomba. */
  pumpRequiresValve: 'XV_100_10' as ValveId,
};

// ─── Manutenção e Machine Learning ─────────────────────────────────────────

export const MAINTENANCE = {
  /** Próxima manutenção preventiva (AAAA-MM-DD). */
  nextDate: '2026-11-20',
  description: 'Manutenção preventiva do agitador e vedação mecânica',
  /** A partir de quantos dias restantes destacar como "próxima". */
  warnDaysBefore: 7,
};

export const ML_MODEL = {
  name: 'Modelo de falhas BR-100',
  version: '1.3.0',
  /** Data de treinamento do modelo (AAAA-MM-DD). */
  trainedAt: '2026-09-15',
  confidence: 0.86,
  /** Probabilidade de falha a partir da qual o card destaca alerta / crítico. */
  warnProbability: 0.25,
  critProbability: 0.5,
};

// ─── Simulação ─────────────────────────────────────────────────────────────

export const SIMULATION = {
  /** Fator de aceleração: segundos de processo por segundo real. */
  acceleration: 60,
  accelerationOptions: [1, 10, 30, 60, 120, 300],
  /** Intervalo de leitura do simulador (ms). */
  scanMs: 1_000,
  /** Etapa e minuto de início ao abrir a aplicação (demonstração). */
  startPhase: 4,
  startMinute: 12,
  ambientTemperature: 25,
  /**
   * Atalho para abrir/fechar o painel de simulação (Ctrl + Shift + tecla).
   * Evite S (captura de tela no Edge) e D (favoritos no Chrome).
   */
  panelShortcutKey: 'F9',
};

// ─── Fonte de dados e MQTT ─────────────────────────────────────────────────

export type SourceKind = 'simulacao' | 'mqtt' | 'real';

export const DATA_SOURCE = {
  /**
   * Fonte usada ao abrir a IHM. A troca feita no painel de simulação fica salva
   * neste navegador e tem prioridade sobre este valor.
   */
  active: 'simulacao' as SourceKind,
};

/** Conexão MQTT via WebSocket seguro (mesmo broker e biblioteca do exemplo do LED). */
export const MQTT = {
  host: 'broker.hivemq.com',
  port: 8884,
  useSSL: true,
  /** Prefixo de todos os tópicos (termina com "/"). Leituras em <prefixo>dados. */
  topicPrefix: 'senai661/br100-equipeDEV/',
  /** Início do clientId; o restante é um número aleatório. */
  clientIdPrefix: 'BR100-',
  /** Tempo máximo para conectar (s). */
  timeoutS: 5,
  /** Intervalo do "ping" que detecta queda da conexão (s). */
  keepAliveS: 30,
  /** Espera entre tentativas de reconexão: começa aqui e dobra a cada falha (s)... */
  reconnectMinS: 2,
  /** ...até este máximo; ao chegar nele, a comunicação passa a "Offline" (s). */
  reconnectMaxS: 30,
  /** Sem atualização há mais que isso, o valor é marcado como "dado antigo" (min). */
  staleAfterMin: 10,
  /** Escala aceita para a rotação do agitador (rpm). */
  rpmMax: 300,
};

/**
 * Biorreator REAL: um servidor Node-RED publica (~1 s)
 * - etapas e produção em `topic`, uma chave por mensagem: {"Produção":true}, {"3_Check_Pressão_ok":false};
 * - variáveis analógicas em `analogTopic`, lista com um objeto:
 *   [{"PIT_100_01":0,"LIT_100_01":0,"TIT_100_01":27.0001,"AIT_100-01":7.5954}].
 * A IHM só LÊ estes tópicos: nunca publica nada neles.
 */
export const REAL_EQUIPMENT = {
  topic: 'senai661/appiot/biorreator',
  analogTopic: 'senai661/appiot/biorreator/a',
  /** Chave do estado de produção (true = em execução). Comparada sem acento e sem maiúsculas. */
  productionKey: 'Produção',
  /** Etapas: o NÚMERO no início da chave (1 a 11) identifica a etapa; true = concluída. */
  phaseKeyPattern: /^(\d{1,2})_/,
  /**
   * Chaves de variáveis analógicas → tag da IHM. Comparadas sem acento e sem
   * maiúsculas, depois de trocar "-" por "_" e tirar espaços ("AIT_100-01" = AIT_100_01).
   */
  tagKeys: {
    TIT_100_01: 'TIT_100_01',
    PIT_100_01: 'PIT_100_01',
    LIT_100_01: 'LIT_100_01',
    AIT_100_01: 'AIT_100_01',
  } as Partial<Record<string, TagId>>,
  /** Sem mensagens de etapas por mais que isso, a comunicação mostra "Sem dados do equipamento" (s). */
  silenceTimeoutS: 10,
  /** Sem mensagens em analogTopic por mais que isso, os cards analógicos ficam cinza com "dado antigo" (s). */
  analogSilenceTimeoutS: 10,
  /**
   * Ao conectar, as chaves chegam uma a uma: a tela espera um ciclo completo (uma
   * chave repetida) ou este tempo antes de mostrar o estado, para não registrar
   * no histórico mudanças de etapa que não aconteceram (s).
   */
  warmupS: 15,
  /** Aviso mostrado no lugar dos comandos. */
  readOnlyReason: 'Supervisão do equipamento real · somente leitura',
};
