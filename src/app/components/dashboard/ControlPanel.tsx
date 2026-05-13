import { useState } from 'react';
import { ValveControl } from './ValveControl';
import { Power, Activity, AlertOctagon, CheckCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ControlPanelProps {
  onValveToggle?: (id: string, state: boolean) => void;
}

export function ControlPanel({ onValveToggle }: ControlPanelProps) {
  const [valves, setValves] = useState({
    'XV_100_01': false,
    'XV_100_02': false,
    'XV_100_03': false,
    'XV_100_04': false,
    'XV_100_05': false,
    'XV_100_06': false,
    'XV_100_07': false,
    'XV_100_08': false,
    'XV_100_09': false,
    'XV_100_10': false,
  });

  const [motorRunning, setMotorRunning] = useState(false);
  const [pumpRunning, setPumpRunning] = useState(false);
  const [powerOn, setPowerOn] = useState(true);
  const [alarmActive, setAlarmActive] = useState(false);

  const handleValveToggle = (id: string) => {
    const newState = !valves[id as keyof typeof valves];
    setValves(prev => ({ ...prev, [id]: newState }));
    onValveToggle?.(id, newState);
  };

  return (
    <div className="bg-[#141920] border border-[#2a3240] rounded-lg p-6">
      <h2 className="text-xl text-[#00d9ff] mb-6 tracking-wider">PAINEL DE CONTROLE</h2>

      <div className="space-y-6">
        <div>
          <h3 className="text-sm text-[#808080] mb-3">VÁLVULAS</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(valves).map(([id, isOpen]) => (
              <ValveControl
                key={id}
                id={id}
                label={`Válvula ${id.split('_')[2]}`}
                isOpen={isOpen}
                onToggle={handleValveToggle}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-[#2a3240] pt-6">
          <h3 className="text-sm text-[#808080] mb-3">EQUIPAMENTOS</h3>

          <div className="space-y-3">
            <button
              onClick={() => setMotorRunning(!motorRunning)}
              className={`w-full p-4 rounded-lg flex items-center justify-between transition-all ${
                motorRunning
                  ? 'bg-[#00ff88] text-[#0a0e14] hover:bg-[#00cc70]'
                  : 'bg-[#1e2530] text-[#e0e0e0] hover:bg-[#2a3240] border border-[#2a3240]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm">Motor Agitador</div>
                  <div className="text-xs opacity-70 font-mono">MT_100_01</div>
                </div>
              </div>
              <div className="text-xs">
                {motorRunning ? 'LIGADO' : 'DESLIGADO'}
              </div>
            </button>

            <button
              onClick={() => setPumpRunning(!pumpRunning)}
              className={`w-full p-4 rounded-lg flex items-center justify-between transition-all ${
                pumpRunning
                  ? 'bg-[#00ff88] text-[#0a0e14] hover:bg-[#00cc70]'
                  : 'bg-[#1e2530] text-[#e0e0e0] hover:bg-[#2a3240] border border-[#2a3240]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Power className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm">Bomba</div>
                  <div className="text-xs opacity-70 font-mono">P_100_01</div>
                </div>
              </div>
              <div className="text-xs">
                {pumpRunning ? 'LIGADO' : 'DESLIGADO'}
              </div>
            </button>

            <button
              onClick={() => setPowerOn(!powerOn)}
              className={`w-full p-4 rounded-lg flex items-center justify-between transition-all ${
                powerOn
                  ? 'bg-[#00d9ff] text-[#0a0e14] hover:bg-[#00c0e0]'
                  : 'bg-[#1e2530] text-[#e0e0e0] hover:bg-[#2a3240] border border-[#2a3240]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Power className="w-5 h-5" />
                <div className="text-left">
                  <div className="text-sm">Energia Geral</div>
                  <div className="text-xs opacity-70">Sistema Principal</div>
                </div>
              </div>
              <div className="text-xs">
                {powerOn ? 'LIGADO' : 'DESLIGADO'}
              </div>
            </button>
          </div>
        </div>

        <div className="border-t border-[#2a3240] pt-6">
          <h3 className="text-sm text-[#808080] mb-3">AÇÕES</h3>

          <div className="space-y-3">
            <button
              onClick={() => setAlarmActive(false)}
              disabled={!alarmActive}
              className={`w-full p-3 rounded-lg flex items-center justify-center gap-2 transition-all ${
                alarmActive
                  ? 'bg-[#ffaa00] text-[#0a0e14] hover:bg-[#ff9900]'
                  : 'bg-[#1e2530] text-[#808080] border border-[#2a3240] cursor-not-allowed'
              }`}
            >
              <AlertOctagon className="w-4 h-4" />
              <span className="text-sm">Parar Alarme</span>
            </button>

            <button
              className="w-full p-3 rounded-lg flex items-center justify-center gap-2 bg-[#1e2530] text-[#e0e0e0] hover:bg-[#2a3240] border border-[#2a3240] transition-all"
            >
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Verificar Pressão</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
