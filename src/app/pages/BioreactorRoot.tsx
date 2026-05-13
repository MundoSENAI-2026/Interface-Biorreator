import { useState, useEffect } from 'react';
import { Header } from '../components/layout/Header';
import { TankSchematic } from '../components/dashboard/TankSchematic';
import { GaugeCard } from '../components/dashboard/GaugeCard';
import { ControlPanel } from '../components/dashboard/ControlPanel';
import { AIPanel } from '../components/dashboard/AIPanel';
import { BatchChart } from '../components/dashboard/BatchChart';
import { Thermometer, Droplets, Gauge, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import mqtt from 'mqtt';

export function BioreactorRoot() {
  const [temperature, setTemperature] = useState(0);
  const [level, setLevel] = useState(0);
  const [pressure, setPressure] = useState(0);
  const [ph, setPh] = useState(0);
  const [aiAnalysis, setAiAnalysis] = useState("Aguardando telemetria...");

  useEffect(() => {
    // Conectando ao broker via WebSocket para funcionamento no navegador
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    client.on('connect', () => {
      console.log("Conectado ao Broker - Sincronizando Tópicos...");
      // Subscreve aos dados dos sensores e ao tópico de resposta da IA
      client.subscribe('senai/biorreator/dados'); 
      client.subscribe('senai/biorreator/ia');    
    });

    client.on('message', (topic, message) => {
      const messageStr = message.toString();

      // TRATAMENTO DOS DADOS DOS SENSORES
      if (topic === 'senai/biorreator/dados') {
        try {
          const data = JSON.parse(messageStr);
          setTemperature(data.temperatura_c);
          setPressure(data.pressao);
          setLevel(data.nivel);
          setPh(data.ph);

          // Alertas baseados nos limites operacionais
          if (data.temperatura_c > 38.5) toast.error("TIT_100_01: Temperatura Crítica!");
          if (data.nivel > 75) toast.warning("LIT_100_01: Nível Elevado!");
          if (data.pressao > 2.0) toast.error("PIT_100_01: Pressão Acima do Limite!");
        } catch (e) {
          console.error("Erro ao processar telemetria:", e);
        }
      }

      // TRATAMENTO DA RESPOSTA DA IA (EDGE AI)
      if (topic === 'senai/biorreator/ia') {
        console.log("Novo diagnóstico recebido da IA");
        setAiAnalysis(messageStr); // Atualiza o componente AIPanel
      }
    });

    return () => {
      if (client) client.end();
    };
  }, []);

  return (
    <>
      <Header onEmergencyStop={() => toast.error('PARADA DE EMERGÊNCIA!')} />
      
      <main className="p-6 space-y-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {/* O esquema visual recebe todos os dados dinâmicos */}
            <TankSchematic data={{ temperature, level, pressure, ph }} />
            <BatchChart />
          </div>

          <div className="space-y-6">
            {/* Configuração dos Cards de Medição conforme as Tags da Planta */}
            <GaugeCard 
              title="Temperatura" value={temperature} unit="°C" tag="TIT_100_01" 
              criticalThreshold={38.5} icon={<Thermometer className="text-red-500" />} 
              min={0} max={50} 
            />
            
            <GaugeCard 
              title="Nível" value={level} unit="%" tag="LIT_100_01" 
              warningThreshold={75} icon={<Droplets className="text-blue-500" />} 
              min={0} max={100} 
            />
            
            <GaugeCard 
              title="Pressão" value={pressure} unit="kgf/cm²" tag="PIT_100_01" 
              criticalThreshold={2.0} icon={<Gauge className="text-orange-500" />} 
              min={0} max={3} 
            />
            
            <GaugeCard 
              title="pH" value={ph} unit="" tag="AIT_100_01" 
              icon={<FlaskConical className="text-green-500" />} 
              min={0} max={14} 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ControlPanel onValveToggle={(id, state) => console.log(`Válvula ${id}: ${state}`)} />
          </div>
          <div>
            {/* O painel de IA agora recebe o estado aiAnalysis atualizado via MQTT */}
            <AIPanel analysis={aiAnalysis} />
          </div>
        </div>
      </main>
    </>
  );
}