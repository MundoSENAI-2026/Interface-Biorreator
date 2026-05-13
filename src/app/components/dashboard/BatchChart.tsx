import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const generateData = () => {
  const data = [];
  for (let i = 0; i <= 24; i++) {
    data.push({
      time: `${i}h`,
      goldenBatch: 25 + Math.sin(i / 3) * 15 + Math.random() * 5,
      currentBatch: 25 + Math.sin(i / 3) * 15 + Math.random() * 8,
    });
  }
  return data;
};

export function BatchChart() {
  const data = generateData();

  return (
    <div className="bg-[#141920] border border-[#2a3240] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#00d9ff]" />
          <h2 className="text-xl text-[#00d9ff] tracking-wider">ANÁLISE DE BATELADA</h2>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ffaa00]" />
            <span className="text-[#808080]">Golden Batch (Histórico)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#00d9ff]" />
            <span className="text-[#808080]">Batelada Atual</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a3240" />
          <XAxis
            dataKey="time"
            stroke="#808080"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#808080"
            style={{ fontSize: '12px' }}
            label={{ value: 'Temperatura (°C)', angle: -90, position: 'insideLeft', style: { fill: '#808080', fontSize: '12px' } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#141920',
              border: '1px solid #2a3240',
              borderRadius: '8px',
              color: '#e0e0e0'
            }}
          />
          <Line
            type="monotone"
            dataKey="goldenBatch"
            stroke="#ffaa00"
            strokeWidth={2}
            dot={false}
            name="Golden Batch"
          />
          <Line
            type="monotone"
            dataKey="currentBatch"
            stroke="#00d9ff"
            strokeWidth={2}
            dot={false}
            name="Batelada Atual"
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-[#2a3240] pt-4">
        <div className="text-center">
          <div className="text-xs text-[#808080]">Desvio Médio</div>
          <div className="text-lg text-[#00d9ff]">±2.3°C</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[#808080]">Conformidade</div>
          <div className="text-lg text-[#00ff88]">97.8%</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-[#808080]">Tempo Decorrido</div>
          <div className="text-lg text-[#e0e0e0]">18h 42min</div>
        </div>
      </div>
    </div>
  );
}
