import { OctagonAlert } from 'lucide-react';
import { useEffect } from 'react';
import { plantStore, usePlant } from '../data/source';
import { useUi, type ScreenId } from '../data/ui';
import type { PlantState } from '../data/store';
import { Header } from '../components/layout/Header';
import { NavBar } from '../components/layout/NavBar';
import { AboutScreen, AlarmsScreen, MaintenanceScreen, OverviewScreen, SynopticScreen, TrendsScreen } from './screens';

const SCREENS: Record<ScreenId, (p: { plant: PlantState }) => React.ReactNode> = {
  overview: OverviewScreen,
  synoptic: SynopticScreen,
  trends: TrendsScreen,
  alarms: AlarmsScreen,
  maintenance: MaintenanceScreen,
  about: AboutScreen,
};

/** Layout de tela única: cabeçalho e abas fixos, conteúdo ocupa o restante. */
export function BioreactorRoot() {
  const plant = usePlant();
  const { screen } = useUi();

  useEffect(() => {
    plantStore.start();
    return () => plantStore.stop();
  }, []);

  const Screen = SCREENS[screen];

  return (
    <div className="flex h-screen flex-col">
      <Header plant={plant} />
      <NavBar />
      {plant.snapshot?.batch.status === 'emergency' && (
        <div role="alert" className="flex items-center gap-3 border-b-2 border-st-critical bg-st-critical-bg px-6 py-2 text-st-critical-text">
          <OctagonAlert className="size-6 shrink-0" aria-hidden />
          <p className="text-[15px]">
            <strong className="font-semibold">PARADA DE EMERGÊNCIA ATIVA.</strong> Motor e bomba desligados, válvulas fechadas e exaustão aberta.
            Verifique a causa e use “Rearmar emergência” no cabeçalho.
          </p>
        </div>
      )}
      <main className="min-h-0 flex-1 overflow-auto">
        <Screen plant={plant} />
      </main>
    </div>
  );
}
