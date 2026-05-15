import { Brain, TrendingUp, Wrench, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';

interface AIPanelProps {
  aiMessage?: string;
}

export function AIPanel({ aiMessage }: AIPanelProps) {
  const failureProbability = 12.3;
  const nextMaintenance = new Date(2026, 4, 20);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-[#141920] border border-[#2a3240] rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <Brain className="w-5 h-5 text-[#8b5cf6]" />
        <h2 className="text-xl text-[#8b5cf6] tracking-wider">ANÁLISE DE MACHINE LEARNING</h2>
      </div>

      <div className="space-y-6">
        {/* ... (existing cards) ... */}
        <div className="bg-[#1e2530] border border-[#2a3240] rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-[#808080] mb-1">PROBABILIDADE DE FALHA</div>
              <div className="text-3xl text-[#00ff88]">{failureProbability}%</div>
            </div>
            <TrendingUp className="w-5 h-5 text-[#00ff88]" />
          </div>

          <div className="w-full bg-[#0a0e14] rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#00ff88] to-[#00d9ff]"
              initial={{ width: 0 }}
              animate={{ width: `${failureProbability}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                boxShadow: '0 0 10px #00ff88'
              }}
            />
          </div>

          <div className="mt-3 text-xs text-[#808080]">
            Baseado em análise de vibração e temperatura dos últimos 30 dias
          </div>
        </div>

        <div className="bg-[#1e2530] border border-[#2a3240] rounded-lg p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs text-[#808080] mb-1">PRÓXIMA MANUTENÇÃO</div>
              <div className="text-lg text-[#00d9ff]">{formatDate(nextMaintenance)}</div>
            </div>
            <Wrench className="w-5 h-5 text-[#00d9ff]" />
          </div>

          <div className="text-xs text-[#808080]">
            7 dias restantes • Manutenção preventiva programada
          </div>
        </div>

        <div className="bg-[#1e2530] border border-[#ffaa00]/20 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#ffaa00] flex-shrink-0 mt-1" />
            <div>
              <div className="text-sm text-[#ffaa00] mb-2">Recomendações do Sistema</div>
              <div className="text-xs text-[#d1d5db] leading-relaxed whitespace-pre-wrap">
                {aiMessage || (
                  <ul className="space-y-1 text-[#808080]">
                    <li>• Verificar válvula XV_100_03 - Padrão de abertura irregular</li>
                    <li>• Monitorar temperatura pós-esterilização</li>
                    <li>• Calibração do sensor pH recomendada</li>
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* ... (rest of the component) ... */}


        <div className="border-t border-[#2a3240] pt-4">
          <div className="text-xs text-[#808080] mb-2">INDICADORES DE DESEMPENHO</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1e2530] rounded p-3">
              <div className="text-xs text-[#808080]">Eficiência</div>
              <div className="text-xl text-[#00ff88]">94.2%</div>
            </div>
            <div className="bg-[#1e2530] rounded p-3">
              <div className="text-xs text-[#808080]">Uptime</div>
              <div className="text-xl text-[#00d9ff]">99.7%</div>
            </div>
          </div>
        </div>

        <div className="bg-[#0a0e14] border border-[#2a3240] rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span className="text-xs text-[#808080]">Modelo IA ativo</span>
          </div>
          <div className="text-xs text-[#808080]">
            Última atualização: {new Date().toLocaleTimeString('pt-BR')}
          </div>
        </div>
      </div>
    </div>
  );
}
