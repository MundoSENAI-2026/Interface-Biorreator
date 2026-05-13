import { AlertTriangle, Power } from 'lucide-react';
import { useState, useEffect } from 'react';

interface HeaderProps {
  onEmergencyStop: () => void;
}

export function Header({ onEmergencyStop }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStatus, setSystemStatus] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  return (
    <header className="bg-[#141920] border-b border-[#2a3240] px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl tracking-wider text-[#00d9ff]">
            BIORREATOR - MUNDO SENAI
          </h1>

          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              systemStatus === 'normal' ? 'bg-[#00ff88] shadow-[0_0_10px_#00ff88]' :
              systemStatus === 'warning' ? 'bg-[#ffaa00] shadow-[0_0_10px_#ffaa00]' :
              'bg-[#ff3b30] shadow-[0_0_10px_#ff3b30] animate-pulse'
            }`} />
            <span className="text-sm text-[#808080]">
              {systemStatus === 'normal' ? 'Sistema Normal' :
               systemStatus === 'warning' ? 'Atenção' :
               'Crítico'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-xl text-[#00d9ff] font-mono tracking-wider">
              {formatTime(currentTime)}
            </div>
            <div className="text-xs text-[#808080]">
              {formatDate(currentTime)}
            </div>
          </div>

          <button
            onClick={onEmergencyStop}
            className="bg-[#ff3b30] hover:bg-[#ff1f14] text-white px-8 py-3 rounded-lg flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(255,59,48,0.5)] hover:shadow-[0_0_30px_rgba(255,59,48,0.8)]"
          >
            <Power className="w-5 h-5" />
            <span className="tracking-wider">PARADA DE EMERGÊNCIA</span>
          </button>
        </div>
      </div>
    </header>
  );
}
