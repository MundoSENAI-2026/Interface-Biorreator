import { Bot, Sparkles } from 'lucide-react';

// Definimos o que o componente pode receber
interface AIPanelProps {
  analysis: string;
}

export function AIPanel({ analysis }: AIPanelProps) {
  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 text-[#1f538d]">
        <Bot className="w-5 h-5" />
        <h2 className="font-bold text-lg uppercase tracking-wider">Análise Preditiva (Edge AI)</h2>
      </div>

      <div className="flex-1 bg-[#141414] border border-[#333333] rounded-lg p-4 font-mono text-sm text-[#00FF00] overflow-y-auto">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-1 text-[#00FF00] shrink-0" />
          <p className="leading-relaxed">
            {analysis || "Aguardando telemetria para diagnóstico técnico..."}
          </p>
        </div>
      </div>
      
      <div className="mt-4 text-[10px] text-gray-500 text-right uppercase tracking-widest">
        Llama 3.2 via LM Studio
      </div>
    </div>
  );
}