import { motion } from 'motion/react';
import { Thermometer, Gauge, Droplets, FlaskConical } from 'lucide-react';

interface TankData {
  temperature: number;
  level: number;
  pressure: number;
  ph: number;
}

interface TankSchematicProps {
  data: TankData;
}

export function TankSchematic({ data }: TankSchematicProps) {
  const levelPercentage = data.level;

  return (
    <div className="bg-[#141920] border border-[#2a3240] rounded-lg p-8">
      <h2 className="text-xl text-[#00d9ff] mb-6 text-center tracking-wider">DIAGRAMA P&ID - BIORREATOR</h2>

      <div className="relative flex items-center justify-center">
        <svg width="400" height="500" viewBox="0 0 400 500" className="mx-auto">
          <defs>
            <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: '#00d9ff', stopOpacity: 0.3 }} />
              <stop offset="100%" style={{ stopColor: '#00d9ff', stopOpacity: 0.8 }} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          <rect
            x="120"
            y="100"
            width="160"
            height="300"
            fill="none"
            stroke="#2a3240"
            strokeWidth="3"
            rx="5"
          />

          <motion.rect
            x="123"
            y={100 + (300 - (300 * levelPercentage / 100))}
            width="154"
            height={300 * levelPercentage / 100}
            fill="url(#liquidGradient)"
            initial={{ height: 0, y: 400 }}
            animate={{
              height: 300 * levelPercentage / 100,
              y: 100 + (300 - (300 * levelPercentage / 100))
            }}
            transition={{ duration: 1 }}
          />

          <circle cx="200" cy="80" r="25" fill="none" stroke="#2a3240" strokeWidth="2" />
          <line x1="200" y1="55" x2="200" y2="30" stroke="#00d9ff" strokeWidth="2" />

          <circle cx="200" cy="420" r="25" fill="none" stroke="#2a3240" strokeWidth="2" />
          <line x1="200" y1="445" x2="200" y2="470" stroke="#00d9ff" strokeWidth="2" />

          <line x1="110" y1="200" x2="90" y2="200" stroke="#2a3240" strokeWidth="2" />
          <circle cx="70" cy="200" r="8" fill="#00d9ff" filter="url(#glow)" />

          <line x1="290" y1="300" x2="310" y2="300" stroke="#2a3240" strokeWidth="2" />
          <circle cx="330" cy="300" r="8" fill="#00d9ff" filter="url(#glow)" />

          <motion.circle
            cx="200"
            cy="250"
            r="30"
            fill="none"
            stroke="#ffaa00"
            strokeWidth="2"
            strokeDasharray="4 4"
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            style={{ transformOrigin: "200px 250px" }}
          />
          <text x="200" y="255" textAnchor="middle" fill="#808080" fontSize="10">AGITADOR</text>
        </svg>

        <div className="absolute top-4 left-4 bg-[#0a0e14] border border-[#2a3240] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-[#ff3b30]" />
            <div>
              <div className="text-xs text-[#808080]">TIT_100_01</div>
              <div className="text-sm text-[#e0e0e0]">{data.temperature.toFixed(1)}°C</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-[#00ff88]" />
            <div>
              <div className="text-xs text-[#808080]">AIT_100_01</div>
              <div className="text-sm text-[#e0e0e0]">pH {data.ph.toFixed(1)}</div>
            </div>
          </div>
        </div>

        <div className="absolute top-4 right-4 bg-[#0a0e14] border border-[#2a3240] rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-[#00d9ff]" />
            <div>
              <div className="text-xs text-[#808080]">LIT_100_01</div>
              <div className="text-sm text-[#e0e0e0]">{data.level.toFixed(0)}%</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-[#ffaa00]" />
            <div>
              <div className="text-xs text-[#808080]">PIT_100_01</div>
              <div className="text-sm text-[#e0e0e0]">{data.pressure.toFixed(2)} kgf/cm²</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
