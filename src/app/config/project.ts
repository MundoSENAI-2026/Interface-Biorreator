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

  /** Logotipo oficial: coloque o arquivo em public/brand/ com este nome. */
  logoSrc: `${import.meta.env.BASE_URL}brand/senai-logo.svg`,

  objective:
    'Supervisionar um biorreator didático (BR-100) em tempo real: acompanhar as etapas do processo, ' +
    'as variáveis de temperatura, pressão, nível e pH, os alarmes e os intertravamentos de segurança, ' +
    'e usar Machine Learning para antecipar falhas e planejar a manutenção.',

  team: ['Integrante 1', 'Integrante 2', 'Integrante 3'],
  advisor: 'Nome do(a) orientador(a)',

  technologies: [
    { name: 'React 18 + TypeScript', role: 'Interface do supervisório' },
    { name: 'Vite', role: 'Build e servidor local (funciona offline)' },
    { name: 'Tailwind CSS', role: 'Estilos e tokens de cor centralizados' },
    { name: 'Recharts', role: 'Gráficos de tendência e lote de ouro' },
    { name: 'Radix UI', role: 'Diálogos de confirmação acessíveis' },
    { name: 'ISA-101 / ISA-18.2 / ISA-5.1', role: 'IHM de alto desempenho, gestão de alarmes e simbologia' },
    { name: 'OPC UA / MQTT', role: 'Comunicação com o CLP (camada de dados preparada)' },
  ],
};
