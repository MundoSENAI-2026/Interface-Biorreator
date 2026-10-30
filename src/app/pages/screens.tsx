import { PHASES, TAGS, TAG_ORDER, TREND_WINDOW_S, getLimits } from '../config/plant';
import { plantStore, simulation } from '../data/source';
import { tagStatus, type PlantState } from '../data/store';
import { AboutProject } from '../components/dashboard/AboutProject';
import { AlarmBanner } from '../components/dashboard/AlarmBanner';
import { BatchSummary, PhaseTrendGrid, RecentEvents } from '../components/dashboard/OverviewPanels';
import { CommandPanel } from '../components/dashboard/CommandPanel';
import { MaintenanceView } from '../components/dashboard/MaintenanceView';
import { Synoptic } from '../components/dashboard/Synoptic';
import { TrendsView } from '../components/dashboard/TrendsView';
import { HistoryTable } from '../components/hmi/AlarmList';
import { AlarmIndicators } from '../components/dashboard/AlarmIndicators';
import { alarmStats } from '../data/alarmStats';
import { Panel } from '../components/hmi/Panel';
import { ProcessStepper } from '../components/hmi/ProcessStepper';
import { SensorCard } from '../components/hmi/SensorCard';

/*
 * Telas do supervisório. Cada uma ocupa a altura disponível (1920×1080 sem
 * rolagem); abaixo da altura mínima o <main> rola (ex.: notebook 1366×768).
 */

const SCREEN = 'grid h-full min-h-[800px] gap-3 px-4 py-3';

function Stepper({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  return (
    <section aria-label="Etapas do processo">
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
    </section>
  );
}

function SensorRow({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const phaseIndex = s?.batch.phaseIndex ?? 0;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {TAG_ORDER.map((tag) => (
        <SensorCard
          key={tag}
          config={TAGS[tag]}
          value={s ? s.tags[tag] : null}
          limits={getLimits(tag, phaseIndex)}
          status={tagStatus(plant, tag)}
          history={plant.history[tag]}
          windowS={TREND_WINDOW_S}
          processRate={simulation?.acceleration ?? 1}
        />
      ))}
    </div>
  );
}

export function OverviewScreen({ plant }: { plant: PlantState }) {
  return (
    <div className={`${SCREEN} grid-rows-[auto_auto_auto_minmax(0,1fr)]`}>
      <Stepper plant={plant} />
      <AlarmBanner alarms={plant.alarms} lastNormalizedAt={plant.events.find((e) => e.category === 'alarm' && e.action === 'Normalizado')?.time} />
      <SensorRow plant={plant} />
      <div className="grid min-h-0 grid-cols-12 gap-3">
        <div className="col-span-12 grid min-h-0 grid-rows-[minmax(13rem,1fr)_auto] gap-3 xl:col-span-8">
          <PhaseTrendGrid plant={plant} />
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <BatchSummary plant={plant} />
            <RecentEvents plant={plant} />
          </div>
        </div>
        <Panel title="Comandos principais" className="col-span-12 min-h-0 xl:col-span-4" bodyClassName="px-4 py-3">
          <CommandPanel plant={plant} valves="summary" />
        </Panel>
      </div>
    </div>
  );
}

export function SynopticScreen({ plant }: { plant: PlantState }) {
  const phase = PHASES[plant.snapshot?.batch.phaseIndex ?? 0];
  return (
    <div className={`${SCREEN} grid-cols-12`}>
      <Panel title="Sinótico P&ID · BR-100" subtitle={`Limites da etapa: ${phase.name}`} className="col-span-12 min-h-0 lg:col-span-8" bodyClassName="min-h-0 p-3">
        <Synoptic plant={plant} />
      </Panel>
      <Panel title="Comandos" subtitle="Ações críticas pedem confirmação" className="col-span-12 min-h-0 lg:col-span-4" bodyClassName="min-h-0 overflow-auto">
        <CommandPanel plant={plant} />
      </Panel>
    </div>
  );
}

export function TrendsScreen({ plant }: { plant: PlantState }) {
  return (
    <div className={SCREEN}>
      <Panel title="Tendências" subtitle="Lote atual × lote de ouro, ou janela de tempo real" className="min-h-0" bodyClassName="min-h-0">
        <TrendsView plant={plant} />
      </Panel>
    </div>
  );
}

export function AlarmsScreen({ plant }: { plant: PlantState }) {
  const stats = alarmStats(plant.events, plant.snapshot?.batch.startedAt ?? plant.now, plant.now);
  const pending = plant.alarms.some((a) => a.state !== 'acknowledged');
  return (
    <div className={`${SCREEN} grid-rows-[auto_minmax(0,1fr)]`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <AlarmBanner alarms={plant.alarms} lastNormalizedAt={stats.lastNormalizedAt} maxRows={4} linkToAlarms={false} />
        </div>
        {plant.alarms.length > 0 && (
          <button
            onClick={() => plantStore.acknowledgeAll()}
            disabled={!pending}
            className="h-11 shrink-0 rounded-md border border-line-strong bg-surface px-4 text-[15px] text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-disabled"
          >
            Reconhecer todos
          </button>
        )}
      </div>
      <div className="grid min-h-0 grid-cols-12 gap-3 xl:grid-rows-1">
        <div className="col-span-12 grid min-h-0 xl:col-span-5">
          <AlarmIndicators stats={stats} />
        </div>
        <Panel title="Histórico de alarmes e eventos" subtitle="Trilha de auditoria completa" className="col-span-12 min-h-0 xl:col-span-7" bodyClassName="flex min-h-0 flex-col">
          <HistoryTable events={plant.events} />
        </Panel>
      </div>
    </div>
  );
}

export function MaintenanceScreen({ plant }: { plant: PlantState }) {
  return (
    <div className={SCREEN}>
      <MaintenanceView now={plant.now} />
    </div>
  );
}

export function AboutScreen() {
  return (
    <div className={SCREEN}>
      <AboutProject />
    </div>
  );
}
