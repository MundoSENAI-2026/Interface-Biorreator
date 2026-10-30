import { OctagonAlert } from 'lucide-react';
import { useEffect } from 'react';
import { PHASES, TAGS, TAG_ORDER, TREND_WINDOW_S, getLimits } from '../config/plant';
import { plantStore, usePlant } from '../data/source';
import { tagStatus } from '../data/store';
import { formatDuration } from '../lib/format';
import { BatchAnalysis } from '../components/dashboard/BatchAnalysis';
import { CommandPanel } from '../components/dashboard/CommandPanel';
import { MlPanel } from '../components/dashboard/MlPanel';
import { Synoptic } from '../components/dashboard/Synoptic';
import { AlarmList } from '../components/hmi/AlarmList';
import { Panel } from '../components/hmi/Panel';
import { ProcessStepper } from '../components/hmi/ProcessStepper';
import { SensorCard } from '../components/hmi/SensorCard';
import { Header } from '../components/layout/Header';

export function BioreactorRoot() {
  const plant = usePlant();

  useEffect(() => {
    plantStore.start();
    return () => plantStore.stop();
  }, []);

  const s = plant.snapshot;
  const phaseIndex = s?.batch.phaseIndex ?? 0;
  const phase = PHASES[phaseIndex];
  const batchElapsedS = s
    ? s.batch.phaseDurationsS.reduce<number>((acc, d) => acc + (d ?? 0), 0) + (s.batch.status === 'completed' ? 0 : s.batch.phaseElapsedS)
    : 0;

  return (
    <>
      <Header plant={plant} />

      <main className="mx-auto flex max-w-[1880px] flex-col gap-4 px-4 py-4 xl:px-6">
        {s?.batch.status === 'emergency' && (
          <div role="alert" className="flex items-center gap-3 rounded-md border-2 border-st-critical bg-st-critical-bg px-4 py-3 text-st-critical-text">
            <OctagonAlert className="size-6 shrink-0" aria-hidden />
            <p className="text-sm">
              <strong className="font-semibold">PARADA DE EMERGÊNCIA ATIVA.</strong> Motor e bomba desligados, válvulas fechadas e exaustão aberta.
              Verifique a causa e use “Rearmar emergência” no cabeçalho.
            </p>
          </div>
        )}

        <Panel
          title="Etapas do processo"
          subtitle={s ? `Tempo de processo do lote: ${formatDuration(batchElapsedS)}` : undefined}
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto p-3">
            <div className="min-w-[1180px]">
              {s ? (
                <ProcessStepper
                  phases={PHASES}
                  currentIndex={s.batch.phaseIndex}
                  status={s.batch.status}
                  elapsedS={s.batch.phaseElapsedS}
                  durationsS={s.batch.phaseDurationsS}
                />
              ) : (
                <div className="h-20" />
              )}
            </div>
          </div>
        </Panel>

        {/* Variáveis + alarmes: o que é crítico fica no topo */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-7">
            {TAG_ORDER.map((tag) => (
              <SensorCard
                key={tag}
                config={TAGS[tag]}
                value={s ? s.tags[tag] : null}
                limits={getLimits(tag, phaseIndex)}
                status={tagStatus(plant, tag)}
                history={plant.history[tag]}
                windowS={TREND_WINDOW_S}
              />
            ))}
          </div>
          <Panel
            title="Alarmes"
            subtitle="ISA-18.2 · prioridade, estado e reconhecimento"
            className="xl:col-span-5"
          >
            <AlarmList
              alarms={plant.alarms}
              events={plant.events}
              onAcknowledge={(id) => plantStore.acknowledge(id)}
              onAcknowledgeAll={() => plantStore.acknowledgeAll()}
            />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Sinótico P&ID · BR-100" subtitle={`Limites da etapa: ${phase.name}`} className="xl:col-span-7">
            <Synoptic plant={plant} />
          </Panel>
          <Panel title="Comandos" subtitle="Ações críticas pedem confirmação" className="xl:col-span-5">
            <CommandPanel plant={plant} />
          </Panel>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Análise de batelada" subtitle={`Etapa atual: ${phase.name} · lote atual × lote de ouro`} className="xl:col-span-7">
            <BatchAnalysis plant={plant} />
          </Panel>
          <Panel title="Manutenção preditiva (Machine Learning)" className="xl:col-span-5">
            <MlPanel now={plant.now} />
          </Panel>
        </div>
      </main>
    </>
  );
}
