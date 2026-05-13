import { motion } from 'motion/react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';

interface GaugeCardProps {
  title: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  warningThreshold?: number;
  criticalThreshold?: number;
  icon?: React.ReactNode;
  tag: string;
}

export function GaugeCard({
  title,
  value,
  unit,
  min,
  max,
  warningThreshold,
  criticalThreshold,
  icon,
  tag
}: GaugeCardProps) {
  const percentage = ((value - min) / (max - min)) * 100;
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getColor = () => {
    if (criticalThreshold && value >= criticalThreshold) return '#ff3b30';
    if (warningThreshold && value >= warningThreshold) return '#ffaa00';
    return '#00d9ff';
  };

  const getStatus = () => {
    if (criticalThreshold && value >= criticalThreshold) return 'critical';
    if (warningThreshold && value >= warningThreshold) return 'warning';
    return 'normal';
  };

  const color = getColor();
  const status = getStatus();

  return (
    <div className="bg-[#141920] border border-[#2a3240] rounded-lg p-6 hover:border-[#00d9ff] transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {icon}
            <h3 className="text-[#e0e0e0]">{title}</h3>
          </div>
          <div className="text-xs text-[#808080] font-mono">{tag}</div>
        </div>
        {status !== 'normal' && (
          <AlertTriangle
            className={`w-5 h-5 ${status === 'critical' ? 'text-[#ff3b30] animate-pulse' : 'text-[#ffaa00]'}`}
          />
        )}
      </div>

      <div className="flex items-center justify-center mb-4 relative">
        <svg className="w-40 h-40 -rotate-90">
          <circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke="#1e2530"
            strokeWidth="12"
          />
          <motion.circle
            cx="80"
            cy="80"
            r="70"
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{
              filter: `drop-shadow(0 0 8px ${color})`
            }}
          />
        </svg>
        <div className="absolute text-center">
          <div className="text-3xl text-[#e0e0e0] font-mono" style={{ color }}>
            {value.toFixed(1)}
          </div>
          <div className="text-sm text-[#808080]">{unit}</div>
        </div>
      </div>

      <div className="flex justify-between text-xs text-[#808080]">
        <span>Min: {min}{unit}</span>
        <span>Max: {max}{unit}</span>
      </div>

      {(warningThreshold || criticalThreshold) && (
        <div className="mt-3 pt-3 border-t border-[#2a3240]">
          <div className="flex justify-between text-xs">
            {warningThreshold && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#ffaa00]" />
                <span className="text-[#808080]">Alerta: {warningThreshold}{unit}</span>
              </div>
            )}
            {criticalThreshold && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-[#ff3b30]" />
                <span className="text-[#808080]">Crítico: {criticalThreshold}{unit}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
