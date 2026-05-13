import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { TankSchematic } from '../components/dashboard/TankSchematic';
import { GaugeCard } from '../components/dashboard/GaugeCard';
import { ControlPanel } from '../components/dashboard/ControlPanel';
import { AIPanel } from '../components/dashboard/AIPanel';
import { BatchChart } from '../components/dashboard/BatchChart';
import { Thermometer, Droplets, Gauge, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import mqtt from 'mqtt'; // Certifique-se de ter instalado com: npm install mqtt

export function BioreactorRoot() {
  // Estados vinculados às Tags da Lista de Instrumentos
  const [temperature, setTemperature] = useState(0); // TIT_100_01
  const [level, setLevel] = useState(68.5);         // LIT_100_01 (Simulado localmente por enquanto)
  const [pressure, setPressure] = useState(0);      // PIT_100_01
  const [ph, setPh] = useState(6.8);               // AIT_100_01 (Simulado localmente por enquanto)

  useEffect(() => {
    // PASSO C: Conexão com o Broker MQTT via WebSocket
    // Usamos a porta 8084 para conexões seguras (WSS) em navegadores
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    client.on('connect', () => {
      console.log('Conectado ao Broker MQTT - Monitoramento BR-01');
      // Inscreve-se no tópico definido no seu script Python
      client.subscribe('senai/biorreator/dados');
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        
        // Atualiza os estados com os dados reais vindos do maquina.py
        const newTemp = data.temperatura_c;
        const newPressure = data.pressao;

        setTemperature(newTemp);
        setPressure(newPressure);

        // Lógica de Alertas baseada nos dados REAIS recebidos
        if (newTemp >= 38.5) {
          toast.error(`ALERTA TÉCNICO: TIT_100_01 em ${newTemp}°C!`, {
            duration: 3000,
          });
        }

        if (newPressure >= 2.0) {
          toast.error(`CRÍTICO: Pressão PIT_100_01 em ${newPressure} kgf/cm²!`, {
            duration: 3000,
          });
        }

      } catch (error) {
        console.error('Erro ao processar dados MQTT:', error);
      }
    });

    // Limpeza da conexão ao desmontar o componente
    return () => {
      if (client) client.end();
    };
  }, []);

  const handleEmergencyStop = () => {
    toast.error('PARADA DE EMERGÊNCIA ACIONADA!', {
      duration: 5000,
    });
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
                warningThreshold={37.5}
                criticalThreshold={38.5}
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
            <AIPanel />
          </div>
        </div>
      </main>
    </>
  );
}