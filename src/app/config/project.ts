import pkg from '../../../package.json';

/**
 * Dados do projeto exibidos no rodapé e na aba "Sobre o Projeto".
 * Preencha com os dados reais da equipe antes da apresentação.
 */
export const PROJECT = {
  event: 'Projeto Mundo SENAI 2026',
  school: 'Escola SENAI — nome da unidade',
  course: 'Curso — nome do curso',
  /** Versão do sistema (vem do package.json). */
  version: pkg.version,

  /** Logotipo SENAI-SP (arquivo local em public/brand/, funciona offline). */
  logoSrc: `${import.meta.env.BASE_URL}brand/senai-sp.png`,

  title: 'Supervisório do Biorreator BR-100',
  subtitle: 'Monitoramento, alarmes e manutenção preditiva de um biorreator didático, em uma IHM de alto desempenho.',

  objective:
    'Supervisionar um biorreator didático (BR-100) em tempo real: acompanhar as etapas do processo, ' +
    'as variáveis de temperatura, pressão, nível e pH, os alarmes e os intertravamentos de segurança, ' +
    'e usar Machine Learning para antecipar falhas e planejar a manutenção.',

  /** Cards "Problema", "Solução" e "Diferenciais" (2–3 linhas cada). */
  pitch: {
    problem:
      'Em biorreatores, um desvio de temperatura ou pressão pode perder o lote inteiro. Telas confusas e alarmes em excesso atrasam a reação do operador.',
    solution:
      'Um supervisório que mostra o processo etapa por etapa, compara o lote com o lote de ouro, prioriza alarmes e bloqueia comandos inseguros.',
    differentials:
      'IHM no padrão ISA-101, alarmes ISA-18.2 com histórico auditável e Machine Learning que indica o que manter antes da falha.',
  },

  /** Equipe: nome, função no projeto e curso. */
  team: [
    { name: 'Integrante 1', role: 'Interface e IHM', course: 'Curso — nome do curso' },
    { name: 'Integrante 2', role: 'Automação e CLP', course: 'Curso — nome do curso' },
    { name: 'Integrante 3', role: 'Dados e Machine Learning', course: 'Curso — nome do curso' },
  ],
  advisor: { name: 'Nome do(a) orientador(a)', role: 'Orientação técnica' },

  /** Tecnologias em grupos de chips. */
  techGroups: [
    { group: 'Interface', items: ['React 18', 'TypeScript', 'Tailwind CSS', 'Radix UI'] },
    { group: 'Dados e gráficos', items: ['Recharts', 'Store único', 'Simulador de processo'] },
    { group: 'Comunicação', items: ['OPC UA', 'MQTT'] },
    { group: 'Normas', items: ['ISA-101', 'ISA-18.2', 'ISA-5.1'] },
  ],

  /** Link do repositório ou vídeo do projeto para o QR code (vazio = não mostra). */
  qrLink: '',
  qrLabel: 'Repositório do projeto',
};

/** Modo apresentação (tecla P): tela cheia, cursor oculto e abas alternando. */
export const PRESENTATION = {
  /** Tecla que liga/desliga o modo apresentação. */
  key: 'p',
  /** Intervalo da troca automática de abas (s). */
  rotateEveryS: 20,
  /** Após um toque/clique, a rotação pausa e retoma depois deste tempo sem interação (s). */
  resumeAfterS: 60,
  /** Cursor some após este tempo parado (s). */
  hideCursorAfterS: 3,
  /** Abas da rotação, em ordem. */
  screens: ['overview', 'synoptic', 'trends', 'alarms', 'maintenance', 'about'] as const,
};
