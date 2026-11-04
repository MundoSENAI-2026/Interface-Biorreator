import { WifiOff } from 'lucide-react';
import { EQUIPMENT, TAGS, VALVE_BY_ID, type TagId, type ValveId } from '../../config/plant';
import { freshness, tagStatus, type Freshness, type PlantState, type TagStatus } from '../../data/store';
import type { ValveState } from '../../data/types';
import { formatNumber } from '../../lib/format';
import { cn } from '../ui/utils';
import { VALVE_STATE_LABEL } from '../hmi/ValveControl';

/*
 * Sinótico P&ID do BR-100 (estilo ISA-101): cinza para o normal, azul para
 * fluxo/ativo, âmbar/vermelho só para anormalidade. Coordenadas no viewBox 1000×470.
 * `compact` (Visão Geral) omite as descrições das linhas e aumenta os textos,
 * para que continuem legíveis com o desenho reduzido.
 */

const VB_W = 1000;
const VB_H = 470;

// Casco do tanque (costado 400–580) e camisa térmica ao redor
const TANK_PATH = 'M400,132 Q400,94 490,94 Q580,94 580,132 L580,350 Q580,392 490,392 Q400,392 400,350 Z';
const JACKET_PATH = 'M386,170 L386,352 Q386,406 490,406 Q594,406 594,352 L594,170 Z';
const LEVEL_TOP = 100; // 100 %
const LEVEL_BOTTOM = 390; // 0 %

interface Line {
  /** Válvula da linha; ausente = linha sem válvula (ex.: retorno da camisa). */
  valve?: ValveId;
  points: [number, number][];
  at?: [number, number];
  label: string;
  labelAt: [number, number];
  labelAnchor?: 'start' | 'end';
  /** Fluxo exige também a bomba ligada. */
  needsPump?: boolean;
}

const LINES: Line[] = [
  { valve: 'XV_100_01', points: [[16, 140], [400, 140]], at: [230, 140], label: 'Entrada · meio/água', labelAt: [16, 130] },
  { valve: 'XV_100_03', points: [[16, 176], [400, 176]], at: [230, 176], label: 'Entrada · meio de cultura', labelAt: [16, 166] },
  { valve: 'XV_100_09', points: [[16, 212], [400, 212]], at: [230, 212], label: 'Entrada · inóculo', labelAt: [16, 202] },
  { valve: 'XV_100_06', points: [[16, 256], [386, 256]], at: [230, 256], label: 'Vapor · esterilização', labelAt: [16, 246] },
  { valve: 'XV_100_07', points: [[16, 300], [386, 300]], at: [230, 300], label: 'Água de resfriamento', labelAt: [16, 290] },
  { valve: 'XV_100_05', points: [[16, 356], [455, 356], [455, 366]], at: [230, 356], label: 'Aeração · ar estéril', labelAt: [16, 346] },
  { valve: 'XV_100_08', points: [[565, 108], [565, 30], [990, 30]], at: [760, 30], label: 'Exaustão / filtro', labelAt: [990, 54], labelAnchor: 'end' },
  { valve: 'XV_100_02', points: [[460, 403], [460, 428], [16, 428]], at: [230, 428], label: 'Saída · dreno', labelAt: [16, 418] },
  { valve: 'XV_100_04', points: [[490, 406], [490, 456], [16, 456]], at: [230, 456], label: 'Saída · amostragem', labelAt: [16, 446] },
  { valve: 'XV_100_10', points: [[520, 403], [520, 440], [990, 440]], at: [640, 440], label: 'Transferência', labelAt: [990, 464], labelAnchor: 'end', needsPump: true },
];

/** Retorno da camisa: com fluxo quando entra vapor ou água. */
const JACKET_RETURN: Line = { points: [[578, 398], [660, 398]], label: 'Retorno da camisa', labelAt: [668, 403] };

const INSTRUMENTS: { tag: TagId; y: number; tap: [number, number] }[] = [
  { tag: 'PIT_100_01', y: 146, tap: [574, 116] },
  { tag: 'TIT_100_01', y: 214, tap: [594, 214] },
  { tag: 'LIT_100_01', y: 282, tap: [594, 282] },
  { tag: 'AIT_100_01', y: 350, tap: [594, 350] },
];

const VALUE_BOX: Record<TagStatus, { box: string; text: string }> = {
  normal: { box: 'fill-surface stroke-line-strong', text: 'fill-ink' },
  warning: { box: 'fill-st-warning-bg stroke-st-warning', text: 'fill-st-warning-text' },
  critical: { box: 'fill-st-critical-bg stroke-st-critical', text: 'fill-st-critical-text' },
  bad: { box: 'fill-st-offline-bg stroke-st-offline', text: 'fill-ink-muted' },
};

const fill = 'transition-[fill,stroke] duration-200';

function Pipe({ line, flowing }: { line: Line; flowing: boolean }) {
  const pts = line.points.map((p) => p.join(',')).join(' ');
  return (
    <g>
      <polyline
        points={pts}
        fill="none"
        strokeWidth={flowing ? 4 : 3}
        strokeLinejoin="round"
        className="transition-[stroke] duration-200"
        style={{ stroke: flowing ? 'var(--pipe-flow)' : 'var(--pipe-idle)' }}
      />
      {/* Sentido do fluxo: traços claros deslizando, discretos */}
      {flowing && <polyline points={pts} fill="none" strokeWidth={2} strokeLinejoin="round" className="flow-anim stroke-white/60" />}
    </g>
  );
}

function ValveSymbol({ x, y, state }: { x: number; y: number; state: ValveState }) {
  const cls =
    state === 'open' ? 'fill-st-info stroke-st-info'
    : state === 'fault' ? 'fill-st-warning-bg stroke-st-warning-text'
    : 'fill-surface stroke-vessel';
  return (
    <g transform={`translate(${x} ${y})`}>
      <path
        d="M-13,-8 L0,0 L-13,8 Z M13,-8 L0,0 L13,8 Z"
        className={cn(cls, fill)}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeDasharray={state === 'transition' ? '3 2' : undefined}
      />
      <line x1={0} y1={0} x2={0} y2={-14} className="stroke-vessel" strokeWidth={1.75} />
      <rect x={-6} y={-20} width={12} height={6} className="fill-surface stroke-vessel" strokeWidth={1.4} />
    </g>
  );
}

function RunIndicator({ x, y, on, text, size, fresh }: { x: number; y: number; on: boolean; text: string; size: number; fresh?: Freshness }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {fresh && <title>{fresh.title}</title>}
      {/* Verde só no indicador */}
      <circle r={5.5} cx={5.5} cy={-size / 3} className={cn(on ? 'fill-st-running' : 'fill-surface stroke-ink-muted', fill)} strokeWidth={1.4} />
      <text x={16} y={0} className={cn(fresh?.stale ? 'fill-ink-muted' : 'fill-ink-default', 'num')} style={{ fontSize: size }}>{text}</text>
    </g>
  );
}

export function Synoptic({ plant, compact = false }: { plant: PlantState; compact?: boolean }) {
  const s = plant.snapshot;
  const bad = plant.comm !== 'online';
  if (!s) {
    return <div className="flex h-full items-center justify-center text-[15px] text-ink-muted">Aguardando primeira leitura do CLP…</div>;
  }

  // Tamanhos em unidades do viewBox: maiores no modo compacto (desenho reduzido)
  const fs = compact ? { tag: 17, label: 16, value: 25, unit: 16, small: 16 } : { tag: 16, label: 15, value: 23, unit: 15, small: 15 };

  const level = s.tags.LIT_100_01;
  // Nível ainda sem dado (NaN, fonte MQTT): desenha o tanque vazio
  const levelY = LEVEL_BOTTOM - ((LEVEL_BOTTOM - LEVEL_TOP) * (Number.isFinite(level) ? Math.min(100, Math.max(0, level)) : 0)) / 100;
  const fresh = (key: string) => freshness(plant, key);
  const manwayFresh = fresh(EQUIPMENT.manway.id);
  const isFlowing = (line: Line) => !!line.valve && s.valves[line.valve] === 'open' && (!line.needsPump || s.pumpOn);
  const jacketActive = s.valves.XV_100_06 === 'open' || s.valves.XV_100_07 === 'open';
  const rpm = formatNumber(s.motorRpm, 0);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {bad && (
        <div className="mb-2 flex items-center gap-2 rounded border border-st-offline bg-st-offline-bg px-3 py-1.5 text-sm font-medium text-ink-default">
          <WifiOff className="size-4" aria-hidden />
          Comunicação perdida — valores e estados exibidos não são confiáveis
        </div>
      )}
      <svg
        viewBox={compact ? `150 0 ${VB_W - 150} ${VB_H}` : `0 0 ${VB_W} ${VB_H}`}
        className={cn('min-h-0 w-full flex-1', bad && 'opacity-60 grayscale')}
        role="img"
        aria-label="Diagrama P&ID do biorreator BR-100"
      >
        <defs>
          <clipPath id="tank-clip">
            <path d={TANK_PATH} />
          </clipPath>
        </defs>

        {/* Tubulações (desenhadas antes do tanque) */}
        {LINES.map((line) => <Pipe key={line.valve} line={line} flowing={isFlowing(line)} />)}
        <Pipe line={JACKET_RETURN} flowing={jacketActive} />

        {/* Camisa térmica */}
        <path d={JACKET_PATH} className={cn(jacketActive ? 'fill-st-info-bg' : 'fill-sunken', 'stroke-vessel', fill)} strokeWidth={2} />
        {/* Tanque e nível */}
        <path d={TANK_PATH} className="fill-surface" />
        <g clipPath="url(#tank-clip)">
          <rect x={396} y={levelY} width={188} height={LEVEL_BOTTOM - levelY + 4} className="transition-[y,height] duration-200" style={{ fill: 'var(--liquid)' }} />
          <line x1={396} x2={584} y1={levelY} y2={levelY} className="stroke-st-info" strokeWidth={1.5} />
        </g>
        <path d={TANK_PATH} fill="none" className="stroke-vessel" strokeWidth={3} />
        <text x={440} y={Math.max(levelY - 8, 130)} textAnchor="middle" className="fill-ink-default font-medium num" style={{ fontSize: fs.small }}>
          {formatNumber(level, TAGS.LIT_100_01.decimals)} %
        </text>
        <text x={440} y={252} textAnchor="middle" className="fill-ink-muted font-semibold" style={{ fontSize: fs.tag }}>BR-100</text>
        {!compact && (
          <text x={378} y={398} textAnchor="end" className="fill-ink-muted" style={{ fontSize: fs.label }}>Camisa</text>
        )}

        {/* Aspersor de ar */}
        <line x1={455} x2={525} y1={368} y2={368} className="stroke-vessel" strokeWidth={2.5} />
        {[462, 476, 490, 504, 518].map((x) => <circle key={x} cx={x} cy={363} r={2} className="fill-vessel" />)}

        {/* Agitador: motor, eixo e impelidor */}
        <line x1={490} y1={66} x2={490} y2={330} className="stroke-vessel" strokeWidth={3} />
        <path d="M458,330 L522,330 M458,322 L458,338 M522,322 L522,338" className="stroke-vessel" strokeWidth={3.5} />
        <circle cx={490} cy={48} r={18} className="fill-surface stroke-vessel" strokeWidth={2.5} />
        <text x={490} y={54} textAnchor="middle" className="fill-ink font-semibold" style={{ fontSize: 17 }}>M</text>
        <text x={462} y={40} textAnchor="end" className="fill-ink font-mono font-medium" style={{ fontSize: fs.tag }}>{EQUIPMENT.motor.short}</text>
        <RunIndicator x={compact ? 300 : 330} y={66} on={s.motorOn} size={fs.small} text={`${s.motorOn ? 'Ligado' : 'Desligado'} · ${rpm} rpm`} fresh={fresh(EQUIPMENT.motor.id)} />

        {/* Porta de visita */}
        <rect x={416} y={88} width={30} height={10} className={cn(s.manwayOpen ? 'fill-st-warning-bg stroke-st-warning-text' : 'fill-surface stroke-vessel', fill)} strokeWidth={1.75} />
        <text x={406} y={92} textAnchor="end" className={s.manwayOpen ? 'fill-st-warning-text font-semibold' : manwayFresh?.stale ? 'fill-ink-muted' : 'fill-ink-default'} style={{ fontSize: fs.small }}>
          {manwayFresh && <title>{manwayFresh.title}</title>}
          {compact ? 'Porta' : EQUIPMENT.manway.name}: {s.manwayOpen ? 'Aberta' : 'Fechada'}
        </text>

        {/* Bomba de transferência */}
        <g transform="translate(880 440)">
          <circle r={18} className="fill-surface stroke-vessel" strokeWidth={2.5} />
          <path d="M-9,-11 L13,0 L-9,11" fill="none" className="stroke-vessel" strokeWidth={2.5} />
        </g>
        <text x={858} y={410} textAnchor="end" className="fill-ink font-mono font-medium" style={{ fontSize: fs.tag }}>{EQUIPMENT.pump.short}</text>
        <RunIndicator x={868} y={410} on={s.pumpOn} size={fs.small} text={s.pumpOn ? 'Ligada' : 'Desligada'} fresh={fresh(EQUIPMENT.pump.id)} />

        {/* Válvulas + rótulos */}
        {LINES.map((line) => {
          if (!line.valve || !line.at) return null;
          const state = s.valves[line.valve];
          const valveFresh = fresh(line.valve);
          const [x, y] = line.at;
          return (
            <g key={line.valve}>
              {valveFresh && <title>{valveFresh.title}</title>}
              <ValveSymbol x={x} y={y} state={state} />
              {!compact && (
                <text x={line.labelAt[0]} y={line.labelAt[1]} textAnchor={line.labelAnchor ?? 'start'} className="fill-ink-muted" style={{ fontSize: fs.label }}>
                  {line.label}
                </text>
              )}
              <text x={x + 20} y={y - 10} style={{ fontSize: fs.tag }}>
                <tspan className="fill-ink font-mono font-medium">{VALVE_BY_ID[line.valve].short}</tspan>
                <tspan
                  dx={6}
                  className={state === 'fault' ? 'fill-st-warning-text font-semibold' : valveFresh?.stale ? 'fill-ink-muted' : state === 'open' ? 'fill-st-info font-medium' : 'fill-ink-muted'}
                >
                  {VALVE_STATE_LABEL[state]}
                </tspan>
              </text>
            </g>
          );
        })}
        {!compact && (
          <text x={JACKET_RETURN.labelAt[0]} y={JACKET_RETURN.labelAt[1]} className="fill-ink-muted" style={{ fontSize: fs.label }}>
            {JACKET_RETURN.label}
          </text>
        )}

        {/* Instrumentos (balão ISA) e valores */}
        {INSTRUMENTS.map(({ tag, y, tap }) => {
          const cfg = TAGS[tag];
          const status = tagStatus(plant, tag);
          const style = VALUE_BOX[status];
          const [letters, loop] = cfg.isa.split(' ');
          const tagFresh = fresh(tag);
          return (
            <g key={tag}>
              {tagFresh && <title>{tagFresh.title}</title>}
              <polyline points={`${tap[0]},${tap[1]} 610,${tap[1]} 610,${y} 624,${y}`} fill="none" className="stroke-ink-muted" strokeWidth={1.2} strokeDasharray="4 3" />
              <circle cx={650} cy={y} r={26} className="fill-surface stroke-ink-default" strokeWidth={1.75} />
              <line x1={624} x2={676} y1={y} y2={y} className="stroke-ink-default" strokeWidth={1.2} />
              <text x={650} y={y - 7} textAnchor="middle" className="fill-ink font-semibold" style={{ fontSize: 14 }}>{letters}</text>
              <text x={650} y={y + 17} textAnchor="middle" className="fill-ink num" style={{ fontSize: 11 }}>{loop}</text>
              <rect x={690} y={y - 20} width={220} height={40} rx={4} className={cn(style.box, fill)} strokeWidth={1.5} />
              <text x={702} y={y + 8} className={cn(style.text, 'font-semibold num')} style={{ fontSize: fs.value }}>
                {formatNumber(s.tags[tag], cfg.decimals)}
                <tspan className="font-normal" style={{ fontSize: fs.unit }}> {cfg.unit}</tspan>
              </text>
              <text x={902} y={y + 6} textAnchor="end" className={cn(style.text, 'font-semibold')} style={{ fontSize: 13 }}>
                {status === 'critical' ? 'CRÍTICO' : status === 'warning' ? 'ALERTA' : status === 'bad' ? '?' : ''}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legenda */}
      <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-line pt-1.5 text-[13px] text-ink-muted">
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
        <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border border-vessel bg-st-info-bg" /> Camisa com vapor/água</span>
      </div>
    </div>
  );
}
