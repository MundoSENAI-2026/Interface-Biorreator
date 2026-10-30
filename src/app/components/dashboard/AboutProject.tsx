import { BrainCircuit, Cable, Cpu, Gauge, Lightbulb, MonitorCog, Sparkles, Target, type LucideIcon } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { EQUIPMENT, PHASES, VALVE_BY_ID, getLimits } from '../../config/plant';
import { PROJECT } from '../../config/project';
import { simulation } from '../../data/source';
import { formatDurationShort, formatNumber } from '../../lib/format';
import { BrandLogo } from '../layout/BrandLogo';
import { cn } from '../ui/utils';

// ─── Peças ─────────────────────────────────────────────────────────────────

function Card({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-md border border-line bg-surface px-5 py-3', className)}>
      {title && <h2 className="mb-2 text-[15px] font-semibold uppercase tracking-wide text-ink-default">{title}</h2>}
      {children}
    </section>
  );
}

/** QR code gerado localmente (sem serviço externo). */
function QrCode({ text, size = 104 }: { text: string; size?: number }) {
  const path = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c},${r}h1v1h-1z`;
    return { d, n };
  }, [text]);
  return (
    <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} width={size} height={size} role="img" aria-label={`QR code: ${text}`} className="rounded bg-white">
      <path d={path.d} fill="#1c2430" />
    </svg>
  );
}

// ─── Arquitetura ───────────────────────────────────────────────────────────

interface Node {
  icon: LucideIcon;
  title: string;
  items: string[];
  /** No modo demonstração este nó é simulado. */
  simulatedInDemo: boolean;
}

const NODES: Node[] = [
  { icon: Gauge, title: 'Sensores', items: ['TIT · PIT · LIT · AIT', 'XV-01 a XV-10, M-01, P-01'], simulatedInDemo: true },
  { icon: Cpu, title: 'CLP', items: ['Sequência de 11 etapas', 'Intertravamentos'], simulatedInDemo: true },
  { icon: Cable, title: 'Comunicação', items: ['OPC UA / MQTT', 'Watchdog de 5 s'], simulatedInDemo: true },
  { icon: MonitorCog, title: 'Supervisório', items: ['IHM ISA-101', 'Alarmes ISA-18.2'], simulatedInDemo: false },
  { icon: BrainCircuit, title: 'Análise ML', items: ['Probabilidade de falha', 'Plano de manutenção'], simulatedInDemo: true },
];

function Architecture() {
  return (
    <ol className="flex items-stretch" aria-label="Arquitetura do sistema">
      {NODES.map((n, i) => {
        const simulated = !!simulation && n.simulatedInDemo;
        return (
          <li key={n.title} className="flex flex-1 items-center">
            <div className="flex h-full flex-1 flex-col gap-1.5 rounded-md border border-line bg-sunken px-4 py-3">
              <div className="flex items-center gap-2">
                <n.icon className="size-7 shrink-0 text-brand" strokeWidth={1.75} aria-hidden />
                <h3 className="text-[17px] font-semibold text-ink">{n.title}</h3>
                <span
                  className={cn(
                    'ml-auto rounded border px-1.5 py-0.5 text-[13px] font-medium',
                    simulated ? 'border-dashed border-line-strong bg-surface text-ink-muted' : 'border-st-info/40 bg-st-info-bg text-st-info',
                  )}
                >
                  {simulated ? 'Simulado' : 'Real'}
                </span>
              </div>
              <ul className="text-[15px] leading-snug text-ink-default">
                {n.items.map((it) => <li key={it}>{it}</li>)}
              </ul>
            </div>
            {i < NODES.length - 1 && (
              <svg viewBox="0 0 32 12" className="h-3 w-8 shrink-0" aria-hidden>
                <path d="M0,6 H26 M22,1 L28,6 L22,11" fill="none" className="stroke-ink-muted" strokeWidth={1.75} />
              </svg>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ─── Linha do tempo do processo ────────────────────────────────────────────

/** Equipamentos acionados pela receita na etapa (válvulas abertas, motor, bomba). */
function activeEquipment(p: (typeof PHASES)[number]): string[] {
  const list = p.valvesOpen.map((id) => VALVE_BY_ID[id].short);
  if (p.motor) list.unshift(EQUIPMENT.motor.short);
  if (p.pump) list.unshift(EQUIPMENT.pump.short);
  return list.length ? list : ['—'];
}

function ProcessTimeline() {
  return (
    <ol className="relative grid" style={{ gridTemplateColumns: `repeat(${PHASES.length}, minmax(0, 1fr))` }}>
      <span className="absolute inset-x-[4.5%] top-[13px] h-0.5 bg-line-strong" aria-hidden />
      {PHASES.map((p, i) => {
        const target = getLimits('TIT_100_01', i).setpoint;
        return (
          <li key={p.id} className="relative flex flex-col items-center gap-1 px-1 text-center">
            <span className="z-10 flex size-7 items-center justify-center rounded-full border-2 border-brand bg-surface text-[13px] font-semibold text-brand num">
              {i + 1}
            </span>
            <span className="text-[15px] font-medium leading-tight text-ink">{p.name}</span>
            <span className="text-xl font-semibold text-ink num">{formatNumber(target, 0)} °C</span>
            <span className="text-[13px] text-ink-muted num">{formatDurationShort(p.durationMin * 60)}</span>
            <span className="mt-1 flex flex-wrap justify-center gap-1">
              {activeEquipment(p).map((e) => (
                <span key={e} className="rounded border border-line bg-sunken px-1.5 font-mono text-[13px] text-ink-default">{e}</span>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

/** Aba "Sobre o Projeto": página institucional com os dados do config. */
export function AboutProject() {
  const pitch: { icon: LucideIcon; title: string; text: string }[] = [
    { icon: Target, title: 'Problema', text: PROJECT.pitch.problem },
    { icon: Lightbulb, title: 'Solução', text: PROJECT.pitch.solution },
    { icon: Sparkles, title: 'Diferenciais', text: PROJECT.pitch.differentials },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Abertura */}
      <header className="flex items-center gap-6 rounded-md border border-brand/20 bg-brand-soft px-6 py-4">
        <BrandLogo className="h-14" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold text-brand-strong">{PROJECT.title}</h1>
          <p className="truncate text-lg text-ink-default">{PROJECT.subtitle}</p>
        </div>
        <span className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-[15px] font-semibold text-white">{PROJECT.event}</span>
        {PROJECT.qrLink && (
          <figure className="flex shrink-0 flex-col items-center gap-1">
            <QrCode text={PROJECT.qrLink} size={88} />
            <figcaption className="text-[13px] text-ink-muted">{PROJECT.qrLabel}</figcaption>
          </figure>
        )}
      </header>

      {/* Problema · Solução · Diferenciais */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {pitch.map((c) => (
          <Card key={c.title}>
            <div className="mb-1 flex items-center gap-2">
              <c.icon className="size-5 text-brand" aria-hidden />
              <h2 className="text-[15px] font-semibold uppercase tracking-wide text-ink-default">{c.title}</h2>
            </div>
            <p className="text-[15px] leading-snug text-ink">{c.text}</p>
          </Card>
        ))}
      </div>

      <Card title="Arquitetura">
        <Architecture />
      </Card>

      <Card title="Como funciona o processo" className="flex flex-1 flex-col justify-center">
        <ProcessTimeline />
        <p className="mt-2 text-[13px] text-ink-muted">Temperatura alvo, duração nominal e equipamentos acionados em cada etapa, lidos da receita (config/plant.ts).</p>
      </Card>

      {/* Tecnologias + equipe */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <Card title="Tecnologias" className="xl:col-span-5">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
            {PROJECT.techGroups.map((g) => (
              <div key={g.group} className="contents">
                <dt className="text-sm text-ink-muted">{g.group}</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <span key={it} className="rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-sm text-ink">{it}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card title="Equipe" className="xl:col-span-7">
          <ul className="grid grid-cols-2 gap-2 2xl:grid-cols-4">
            <li className="flex items-center gap-3 rounded-md border border-brand/30 bg-brand-soft px-3 py-2">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand text-[15px] font-semibold text-white">
                {initials(PROJECT.advisor.name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{PROJECT.advisor.name}</p>
                <p className="truncate text-[13px] text-brand-strong">{PROJECT.advisor.role}</p>
              </div>
            </li>
            {PROJECT.team.map((m) => (
              <li key={m.name} className="flex items-center gap-3 rounded-md border border-line px-3 py-2">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sunken text-[15px] font-semibold text-ink-default">
                  {initials(m.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
                  <p className="truncate text-[13px] text-ink-default">{m.role}</p>
                  <p className="truncate text-[13px] text-ink-muted">{m.course}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
