import { useEffect } from 'react';
import { plantStore, usePlant } from '../data/source';
import { Header } from '../components/layout/Header';
import { TankSchematic } from '../components/dashboard/TankSchematic';
import { GaugeCard } from '../components/dashboard/GaugeCard';
import { ControlPanel } from '../components/dashboard/ControlPanel';
import { AIPanel } from '../components/dashboard/AIPanel';
import { BatchChart } from '../components/dashboard/BatchChart';
import { Thermometer, Droplets, Gauge, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';

export function BioreactorRoot() {
  const plant = usePlant();
  useEffect(() => {
    plantStore.start();
    return () => plantStore.stop();
  }, []);
  const tags = plant.snapshot?.tags;
  const temperature = tags?.TIT_100_01 ?? 0;
  const level = tags?.LIT_100_01 ?? 0;
  const pressure = tags?.PIT_100_01 ?? 0;
  const ph = tags?.AIT_100_01 ?? 0;

  const handleEmergencyStop = () => {
    toast.error('PARADA DE EMERGÊNCIA ACIONADA!', {
      duration: 5000,
    });
    console.log('Emergency stop activated');
  };

  const handleValveToggle = (id: string, state: boolean) => {
    toast.success(`Válvula ${id} ${state ? 'aberta' : 'fechada'}`, {
      duration: 1500,
    });
  };

  return (
    <>
      <Header onEmergencyStop={handleEmergencyStop} />

      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <TankSchematic
              data={{
                temperature,
                level,
                pressure,
                ph
              }}
            />

            <BatchChart />
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-6">
              <GaugeCard
                title="Temperatura"
                value={temperature}
                unit="°C"
                min={0}
                max={250}
                warningThreshold={128}
                criticalThreshold={130}
                icon={<Thermometer className="w-4 h-4 text-[#ff3b30]" />}
                tag="TIT_100_01"
              />

              <GaugeCard
                title="Nível"
                value={level}
                unit="%"
                min={0}
                max={100}
                warningThreshold={75}
                icon={<Droplets className="w-4 h-4 text-[#00d9ff]" />}
                tag="LIT_100_01"
              />

              <GaugeCard
                title="Pressão"
                value={pressure}
                unit=" kgf/cm²"
                min={0}
                max={2}
                warningThreshold={0.95}
                criticalThreshold={1.0}
                icon={<Gauge className="w-4 h-4 text-[#ffaa00]" />}
                tag="PIT_100_01"
              />

              <GaugeCard
                title="pH"
                value={ph}
                unit=""
                min={0}
                max={14}
                icon={<FlaskConical className="w-4 h-4 text-[#00ff88]" />}
                tag="AIT_100_01"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ControlPanel onValveToggle={handleValveToggle} />
          </div>

          <div>
            <AIPanel />
          </div>
        </div>
      </main>
    </>
  );
}
