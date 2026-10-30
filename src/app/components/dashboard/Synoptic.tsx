import { WifiOff } from 'lucide-react';
import { EQUIPMENT, TAGS, VALVE_BY_ID, type TagId, type ValveId } from '../../config/plant';
import { tagStatus, type PlantState, type TagStatus } from '../../data/store';
import type { ValveState } from '../../data/types';
import { formatNumber } from '../../lib/format';
import { VALVE_STATE_LABEL } from '../hmi/ValveControl';

/*
 * Sinótico P&ID do BR-100 (estilo ISA-101): cinza para o normal, azul para
 * fluxo/ativo, âmbar/vermelho só para anormalidade. Coordenadas no viewBox 760×470.
 */

const VB_W = 760;
const VB_H = 470;

// Casco do tanque: costado de 300 a 460, tampos elípticos
const TANK_PATH = 'M300,122 Q300,86 380,86 Q460,86 460,122 L460,344 Q460,382 380,382 Q300,382 300,344 Z';
const LEVEL_TOP = 92; // 100 %
const LEVEL_BOTTOM = 380; // 0 %

interface Line {
  valve: ValveId;
  /** Pontos da tubulação no sentido do fluxo. */
  points: [number, number][];
  /** Posição e orientação do símbolo da válvula. */
  at: [number, number];
  vertical?: boolean;
  label: string;
  labelAt: [number, number];
  labelAnchor?: 'start' | 'end' | 'middle';
  /** Fluxo exige também a bomba ligada. */
  needsPump?: boolean;
}

const LINES: Line[] = [
  { valve: 'XV_100_01', points: [[24, 128], [300, 128]], at: [200, 128], label: 'Entrada · meio/água', labelAt: [24, 120] },
  { valve: 'XV_100_03', points: [[24, 160], [300, 160]], at: [200, 160], label: 'Entrada · meio de cultura', labelAt: [24, 152] },
  { valve: 'XV_100_09', points: [[24, 192], [300, 192]], at: [200, 192], label: 'Entrada · inóculo', labelAt: [24, 184] },
  { valve: 'XV_100_06', points: [[24, 236], [300, 236]], at: [200, 236], label: 'Reserva (a confirmar)', labelAt: [24, 228] },
  { valve: 'XV_100_07', points: [[24, 268], [300, 268]], at: [200, 268], label: 'Reserva (a confirmar)', labelAt: [24, 260] },
  { valve: 'XV_100_05', points: [[24, 340], [380, 340], [380, 356]], at: [200, 340], label: 'Aeração · ar estéril', labelAt: [24, 332] },
  { valve: 'XV_100_08', points: [[430, 92], [430, 34], [736, 34]], at: [540, 34], label: 'Exaustão / filtro', labelAt: [736, 52], labelAnchor: 'end' },
  { valve: 'XV_100_02', points: [[346, 378], [346, 414], [24, 414]], at: [200, 414], label: 'Saída · dreno', labelAt: [24, 406] },
  { valve: 'XV_100_04', points: [[380, 382], [380, 444], [24, 444]], at: [200, 444], label: 'Saída · amostragem', labelAt: [24, 436] },
  {
    valve: 'XV_100_10', points: [[414, 378], [414, 424], [736, 424]], at: [470, 424],
    label: 'Transferência', labelAt: [736, 416], labelAnchor: 'end', needsPump: true,
  },
];

const INSTRUMENTS: { tag: TagId; y: number; tap: [number, number] }[] = [
  { tag: 'PIT_100_01', y: 128, tap: [452, 108] },
  { tag: 'TIT_100_01', y: 198, tap: [460, 198] },
  { tag: 'LIT_100_01', y: 268, tap: [460, 268] },
  { tag: 'AIT_100_01', y: 338, tap: [460, 338] },
];

const VALUE_BOX: Record<TagStatus, { box: string; text: string }> = {
  normal: { box: 'fill-surface stroke-line-strong', text: 'fill-ink' },
  warning: { box: 'fill-st-warning-bg stroke-st-warning', text: 'fill-st-warning-text' },
  critical: { box: 'fill-st-critical-bg stroke-st-critical', text: 'fill-st-critical-text' },
  bad: { box: 'fill-st-offline-bg stroke-st-offline', text: 'fill-ink-disabled' },
};

function ValveSymbol({ x, y, vertical, state }: { x: number; y: number; vertical?: boolean; state: ValveState }) {
  const cls =
    state === 'open' ? 'fill-st-info stroke-st-info'
    : state === 'fault' ? 'fill-st-warning-bg stroke-st-warning-text'
    : 'fill-surface stroke-vessel';
  return (
    <g transform={`translate(${x} ${y}) rotate(${vertical ? 90 : 0})`}>
      <path
        d="M-11,-7 L0,0 L-11,7 Z M11,-7 L0,0 L11,7 Z"
        className={cls}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeDasharray={state === 'transition' ? '2 2' : undefined}
      />
      {/* Atuador */}
      <line x1={0} y1={0} x2={0} y2={-12} className="stroke-vessel" strokeWidth={1.5} />
      <rect x={-5} y={-17} width={10} height={5} className="fill-surface stroke-vessel" strokeWidth={1.2} />
      {state === 'fault' && (
        <text x={0} y={-21} textAnchor="middle" className="fill-st-warning-text text-[11px] font-bold">!</text>
      )}
    </g>
  );
}

function EquipmentState({ x, y, on, labelOn, labelOff }: { x: number; y: number; on: boolean; labelOn: string; labelOff: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {/* Verde só no indicador */}
      <circle r={4.5} cx={4.5} cy={-4} className={on ? 'fill-st-running' : 'fill-surface stroke-ink-muted'} strokeWidth={1.2} />
      <text x={13} y={0} className="fill-ink-default text-[11px]">{on ? labelOn : labelOff}</text>
    </g>
  );
}

export function Synoptic({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const bad = plant.comm !== 'online';
  if (!s) {
    return <div className="flex h-80 items-center justify-center text-sm text-ink-muted">Aguardando primeira leitura do CLP…</div>;
  }

  const level = s.tags.LIT_100_01;
  const levelY = LEVEL_BOTTOM - ((LEVEL_BOTTOM - LEVEL_TOP) * Math.min(100, Math.max(0, level))) / 100;

  const isFlowing = (line: Line) => s.valves[line.valve] === 'open' && (!line.needsPump || s.pumpOn);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {bad && (
        <div className="mb-2 flex items-center gap-2 rounded border border-st-offline bg-st-offline-bg px-3 py-1.5 text-xs font-medium text-ink-default">
          <WifiOff className="size-4" aria-hidden />
          Comunicação perdida — valores e estados exibidos não são confiáveis
        </div>
      )}
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={bad ? 'min-h-0 w-full flex-1 opacity-60 grayscale' : 'min-h-0 w-full flex-1'} role="img" aria-label="Diagrama P&ID do biorreator BR-100">
        <defs>
          <marker id="arrow-flow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 Z" className="fill-st-info" />
          </marker>
          <clipPath id="tank-clip">
            <path d={TANK_PATH} />
          </clipPath>
        </defs>

        {/* Tubulações */}
        {LINES.map((line) => {
          const flowing = isFlowing(line);
          return (
            <polyline
              key={line.valve}
              points={line.points.map((p) => p.join(',')).join(' ')}
              fill="none"
              strokeWidth={flowing ? 3.5 : 2.5}
              strokeLinejoin="round"
              style={{ stroke: flowing ? 'var(--pipe-flow)' : 'var(--pipe-idle)' }}
              markerEnd={flowing ? 'url(#arrow-flow)' : undefined}
            />
          );
        })}

        {/* Tanque e nível */}
        <g clipPath="url(#tank-clip)">
          <rect x={296} y={levelY} width={168} height={LEVEL_BOTTOM - levelY + 4} style={{ fill: 'var(--liquid)' }} />
          <line x1={296} x2={464} y1={levelY} y2={levelY} className="stroke-st-info" strokeWidth={1} />
        </g>
        <path d={TANK_PATH} fill="none" className="stroke-vessel" strokeWidth={2.5} />
        <text x={334} y={levelY - 6} textAnchor="middle" className="fill-ink-default text-[11px] num">
          {formatNumber(level, TAGS.LIT_100_01.decimals)} %
        </text>
        <text x={334} y={240} textAnchor="middle" className="fill-ink-muted text-[13px] font-semibold">BR-100</text>

        {/* Aspersor de ar */}
        <line x1={350} x2={410} y1={358} y2={358} className="stroke-vessel" strokeWidth={2} />
        {[356, 368, 380, 392, 404].map((x) => (
          <circle key={x} cx={x} cy={354} r={1.5} className="fill-vessel" />
        ))}

        {/* Agitador */}
        <line x1={380} y1={56} x2={380} y2={318} className="stroke-vessel" strokeWidth={2.5} />
        <path d="M352,318 L408,318 M352,312 L352,324 M408,312 L408,324" className="stroke-vessel" strokeWidth={3} />
        <circle cx={380} cy={42} r={15} className="fill-surface stroke-vessel" strokeWidth={2} />
        <text x={380} y={47} textAnchor="middle" className="fill-ink text-[13px] font-semibold">M</text>
        <text x={358} y={38} textAnchor="end" className="fill-ink-default font-mono text-[11px]">{EQUIPMENT.motor.short}</text>
        <EquipmentState x={292} y={58} on={s.motorOn} labelOn="Ligado" labelOff="Desligado" />

        {/* Porta de visita */}
        <rect x={318} y={80} width={28} height={9} className={s.manwayOpen ? 'fill-st-warning-bg stroke-st-warning-text' : 'fill-surface stroke-vessel'} strokeWidth={1.5} />
        <text x={332} y={74} textAnchor="end" className="fill-ink-default text-[11px]">
          {EQUIPMENT.manway.name}: {s.manwayOpen ? 'Aberta' : 'Fechada'}
        </text>

        {/* Bomba de transferência */}
        <g transform="translate(600 424)">
          <circle r={16} className="fill-surface stroke-vessel" strokeWidth={2} />
          <path d="M-8,-10 L12,0 L-8,10" fill="none" className="stroke-vessel" strokeWidth={2} />
        </g>
        <text x={600} y={458} textAnchor="middle" className="fill-ink-default font-mono text-[11px]">{EQUIPMENT.pump.short}</text>
        <EquipmentState x={622} y={452} on={s.pumpOn} labelOn="Ligada" labelOff="Desligada" />

        {/* Válvulas + rótulos */}
        {LINES.map((line) => {
          const state = s.valves[line.valve];
          const cfg = VALVE_BY_ID[line.valve];
          const [lx, ly] = line.labelAt;
          return (
            <g key={line.valve}>
              <ValveSymbol x={line.at[0]} y={line.at[1]} vertical={line.vertical} state={state} />
              <text x={lx} y={ly} textAnchor={line.labelAnchor ?? 'start'} className="fill-ink-muted text-[11px]">{line.label}</text>
              <text x={line.at[0] + 16} y={line.at[1] - 8} className="text-[11px]">
                <tspan className="fill-ink font-mono font-medium">{cfg.short}</tspan>
                <tspan
                  dx={6}
                  className={state === 'fault' ? 'fill-st-warning-text font-semibold' : state === 'open' ? 'fill-st-info' : 'fill-ink-muted'}
                >
                  {VALVE_STATE_LABEL[state]}
                </tspan>
              </text>
            </g>
          );
        })}

        {/* Instrumentos (balão ISA) e valores */}
        {INSTRUMENTS.map(({ tag, y, tap }) => {
          const cfg = TAGS[tag];
          const status = tagStatus(plant, tag);
          const style = VALUE_BOX[status];
          const [letters, loop] = cfg.isa.split(' ');
          return (
            <g key={tag}>
              <polyline points={`${tap[0]},${tap[1]} 500,${tap[1]} 500,${y} 506,${y}`} fill="none" className="stroke-ink-muted" strokeWidth={1} strokeDasharray="3 3" />
              <circle cx={526} cy={y} r={20} className="fill-surface stroke-ink-default" strokeWidth={1.5} />
              <line x1={506} x2={546} y1={y} y2={y} className="stroke-ink-default" strokeWidth={1} />
              <text x={526} y={y - 5} textAnchor="middle" className="fill-ink text-[11px] font-semibold">{letters}</text>
              <text x={526} y={y + 13} textAnchor="middle" className="fill-ink text-[9px] num">{loop}</text>
              <rect x={556} y={y - 15} width={150} height={30} rx={3} className={style.box} strokeWidth={1.2} />
              <text x={566} y={y + 5} className={`${style.text} text-[15px] font-semibold num`}>
                {formatNumber(s.tags[tag], cfg.decimals)}
                <tspan className="text-[11px] font-normal"> {cfg.unit}</tspan>
              </text>
              <text x={698} y={y + 4} textAnchor="end" className={`${style.text} text-[10px] font-semibold`}>
                {status === 'critical' ? 'CRÍTICO' : status === 'warning' ? 'ALERTA' : status === 'bad' ? '?' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legenda */}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-1 w-6" style={{ background: 'var(--pipe-flow)' }} /> Com fluxo</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-6" style={{ background: 'var(--pipe-idle)' }} /> Sem fluxo</span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 16" className="h-3 w-5"><path d="M2 2 L12 8 L2 14 Z M22 2 L12 8 L22 14 Z" className="fill-st-info stroke-st-info" /></svg>
          Válvula aberta
        </span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 24 16" className="h-3 w-5"><path d="M2 2 L12 8 L2 14 Z M22 2 L12 8 L22 14 Z" className="fill-surface stroke-vessel" strokeWidth={1.5} /></svg>
          Válvula fechada
        </span>
        <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-full bg-st-running" /> Equipamento em operação</span>
      </div>
    </div>
  );
}
