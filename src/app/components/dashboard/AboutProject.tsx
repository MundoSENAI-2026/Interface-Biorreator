import { ArrowRight, BrainCircuit, Cable, Cpu, Gauge, MonitorCog, type LucideIcon } from 'lucide-react';
import { PLANT } from '../../config/plant';
import { PROJECT } from '../../config/project';
import { simulation } from '../../data/source';
import { Panel } from '../hmi/Panel';

interface Stage {
  icon: LucideIcon;
  title: string;
  items: string[];
  simulated?: boolean;
}

const ARCHITECTURE: Stage[] = [
  { icon: Gauge, title: 'Sensores e atuadores', items: ['TIT · PIT · LIT · AIT', 'Válvulas XV-01 a XV-10', 'Agitador M-01 · bomba P-01'] },
  { icon: Cpu, title: 'CLP', items: ['Sequência das 11 etapas', 'Intertravamentos', 'Leitura a cada 1 s'], simulated: true },
  { icon: Cable, title: 'Comunicação', items: ['OPC UA ou MQTT', 'Gateway para o navegador', 'Watchdog de 5 s'], simulated: true },
  { icon: MonitorCog, title: 'Supervisório', items: ['IHM ISA-101', 'Alarmes ISA-18.2', 'Tendências e histórico'] },
  { icon: BrainCircuit, title: 'Análise ML', items: ['Probabilidade de falha', 'Fatores explicados', 'Plano de manutenção'] },
];

function ArchitectureDiagram() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ol className="flex min-h-0 flex-1 items-stretch gap-2" aria-label="Arquitetura do sistema">
        {ARCHITECTURE.map((stage, i) => (
          <li key={stage.title} className="flex flex-1 items-stretch gap-2">
            <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-md border border-line bg-sunken p-4 text-center">
              <stage.icon className="size-12 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />
              <h3 className="text-xl font-semibold text-ink">{stage.title}</h3>
              <ul className="flex flex-col gap-1.5 text-base text-ink-default">
                {stage.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
              {simulation && stage.simulated && (
                <span className="w-fit rounded border border-dashed border-line-strong bg-surface px-2 py-0.5 text-sm text-ink-muted">
                  Hoje: simulado
                </span>
              )}
            </div>
            {i < ARCHITECTURE.length - 1 && (
              <div className="flex items-center" aria-hidden>
                <ArrowRight className="size-6 text-ink-muted" />
              </div>
            )}
          </li>
        ))}
      </ol>
      {simulation && (
        <p className="mt-3 text-[15px] text-ink-muted">
          No modo demonstração, o CLP e a comunicação são simulados no próprio computador. Para o equipamento real, basta trocar
          a fonte de dados em <code className="font-mono text-[13px]">src/app/data/source.ts</code>.
        </p>
      )}
    </div>
  );
}

/** Aba "Sobre o Projeto": objetivo, arquitetura, tecnologias e equipe. */
export function AboutProject() {
  return (
    <div className="grid h-full min-h-0 grid-cols-12 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <Panel title="Objetivo" subtitle={`${PROJECT.event} · ${PLANT.equipmentName}`} className="col-span-12">
        <p className="max-w-[110ch] text-lg leading-relaxed text-ink">{PROJECT.objective}</p>
      </Panel>

      <Panel title="Arquitetura" subtitle="Do sensor à análise de Machine Learning" className="col-span-12 min-h-0 xl:col-span-8" bodyClassName="min-h-0">
        <ArchitectureDiagram />
      </Panel>

      <div className="col-span-12 grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3 xl:col-span-4">
        <Panel title="Tecnologias" className="min-h-0" bodyClassName="min-h-0 overflow-auto">
          <dl className="flex flex-col gap-2">
            {PROJECT.technologies.map((t) => (
              <div key={t.name} className="flex items-baseline justify-between gap-4 border-b border-line pb-1.5 last:border-b-0">
                <dt className="text-[15px] font-medium text-ink">{t.name}</dt>
                <dd className="text-right text-sm text-ink-muted">{t.role}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Equipe">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[15px] text-ink">
            {PROJECT.team.map((name) => <li key={name}>{name}</li>)}
          </ul>
          <p className="mt-3 border-t border-line pt-2 text-[15px]">
            <span className="text-ink-muted">Orientação: </span>
            <span className="font-medium text-ink">{PROJECT.advisor}</span>
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {PROJECT.school} · {PROJECT.course}
          </p>
        </Panel>
      </div>
    </div>
  );
}
