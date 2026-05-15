import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { TankSchematic } from '../components/dashboard/TankSchematic';
import { GaugeCard } from '../components/dashboard/GaugeCard';
import { ControlPanel } from '../components/dashboard/ControlPanel';
import { AIPanel } from '../components/dashboard/AIPanel';
import { BatchChart } from '../components/dashboard/BatchChart';
import { Thermometer, Droplets, Gauge, FlaskConical, Brain } from 'lucide-react';
import { toast } from 'sonner';

export function BioreactorRoot() {
  const [temperature, setTemperature] = useState(0);
  const [level, setLevel] = useState(0);
  const [pressure, setPressure] = useState(0);
  const [ph, setPh] = useState(0);
  const [aiMessage, setAiMessage] = useState<string>('');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8765');

    ws.onopen = () => {
      console.log('✅ Conectado ao servidor de dados');
      toast.success('Conectado ao sistema de monitoramento');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.tipo === 'sensores') {
          const { temperatura_c, nivel, pressao, ph } = data.dados;
          setTemperature(temperatura_c);
          setLevel(nivel);
          setPressure(pressao);
          setPh(ph);

          // Alertas visuais rápidos via Toast
          if (temperatura_c > 38) toast.error('ALERTA: Temperatura crítica!');
          if (pressao > 2) toast.error('ALERTA: Pressão elevada!');
        } else if (data.tipo === 'ia_analise') {
          setAiMessage(data.mensagem);
          if (!data.mensagem.includes('✅')) {
            toast.warning('Nova análise da IA disponível', {
              icon: <Brain className="w-4 h-4" />
            });
          }
        }
      } catch (error) {
        console.error('Erro ao processar mensagem do WebSocket:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Erro no WebSocket:', error);
      toast.error('Erro na conexão com o servidor de dados');
    };

    ws.onclose = () => {
      console.log('❌ Desconectado do servidor');
      toast.warning('Conexão perdida. Tentando reconectar...');
      // Tenta reconectar após 5 segundos
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    };

    return () => {
      ws.close();
    };
  }, []);

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
                max={60}
                warningThreshold={38}
                criticalThreshold={40}
                icon={<Thermometer className="w-4 h-4 text-[#ff3b30]" />}
                tag="TIT_100_01"
              />

              <GaugeCard
                title="Nível"
                value={level}
                unit="%"
                min={0}
                max={100}
                warningThreshold={80}
                icon={<Droplets className="w-4 h-4 text-[#00d9ff]" />}
                tag="LIT_100_01"
              />

              <GaugeCard
                title="Pressão"
                value={pressure}
                unit=" bar"
                min={0}
                max={4}
                warningThreshold={1.8}
                criticalThreshold={2.0}
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
            <AIPanel aiMessage={aiMessage} />
          </div>
        </div>
      </main>
    </>
  );
}

