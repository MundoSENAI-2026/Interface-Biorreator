import { motion } from 'motion/react';
import { ToggleRight, ToggleLeft } from 'lucide-react';

interface ValveControlProps {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (id: string) => void;
}

export function ValveControl({ id, label, isOpen, onToggle }: ValveControlProps) {
  return (
    <div className="bg-[#1e2530] border border-[#2a3240] rounded-lg p-3 hover:border-[#00d9ff] transition-all">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs text-[#808080] font-mono">{id}</div>
          <div className="text-sm text-[#e0e0e0]">{label}</div>
        </div>
        <motion.div
          className={`w-3 h-3 rounded-full ${
            isOpen
              ? 'bg-[#00ff88] shadow-[0_0_8px_#00ff88]'
              : 'bg-[#808080]'
          }`}
          animate={{
            boxShadow: isOpen
              ? ['0 0 8px #00ff88', '0 0 12px #00ff88', '0 0 8px #00ff88']
              : '0 0 0px #808080'
          }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <button
        onClick={() => onToggle(id)}
        className={`w-full py-2 px-3 rounded flex items-center justify-center gap-2 transition-all ${
          isOpen
            ? 'bg-[#00ff88] text-[#0a0e14] hover:bg-[#00cc70]'
            : 'bg-[#2a3240] text-[#808080] hover:bg-[#3a4250]'
        }`}
      >
        {isOpen ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
        <span className="text-xs">{isOpen ? 'ABERTA' : 'FECHADA'}</span>
      </button>
    </div>
  );
}
