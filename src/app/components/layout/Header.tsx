import { User, Wifi, WifiOff } from 'lucide-react';
import { PHASES, PLANT } from '../../config/plant';
import { overallStatus, type PlantState } from '../../data/store';
import { simulation } from '../../data/source';
import type { BatchStatus } from '../../data/types';
import { formatDate, formatDuration, formatTime, pluralize } from '../../lib/format';
import { EmergencyButton } from '../dashboard/EmergencyButton';
import { StatusBadge, type BadgeStatus } from '../hmi/StatusBadge';
import { cn } from '../ui/utils';

const BATCH_STATUS: Record<BatchStatus, { label: string; badge: BadgeStatus }> = {
  idle: { label: 'Aguardando início', badge: 'stopped' },
  running: { label: 'Automático · em execução', badge: 'running' },
  stopped: { label: 'Parado · modo manual', badge: 'stopped' },
  emergency: { label: 'Emergência', badge: 'critical' },
  completed: { label: 'Lote concluído', badge: 'stopped' },
};

/** Logotipo provisório (texto). Substitua pelo SVG oficial do manual de marca. */
function SenaiLogo() {
  return (
    <div className="flex h-9 items-center bg-brand-red px-3" aria-label="SENAI">
      <span className="text-xl font-bold italic tracking-tight text-white">SENAI</span>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col justify-center gap-0.5', className)}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="truncate text-sm font-medium text-ink">{children}</div>
    </div>
  );
}

export function Header({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const status = overallStatus(plant);
  const activeAlarms = plant.alarms.filter((a) => a.state !== 'normalized');
  const counts = {
    critical: activeAlarms.filter((a) => a.priority === 'critical').length,
    warning: activeAlarms.filter((a) => a.priority === 'warning').length,
  };
  const ageS = plant.lastReadAt ? Math.max(0, Math.round((plant.now - plant.lastReadAt) / 1000)) : null;
  const batchStatus = s ? BATCH_STATUS[s.batch.status] : null;
  const batchElapsedS = s
    ? s.batch.phaseDurationsS.reduce<number>((acc, d) => acc + (d ?? 0), 0) + (s.batch.status === 'completed' ? 0 : s.batch.phaseElapsedS)
    : 0;

  const statusLabel =
    status === 'critical'
      ? `Crítico · ${pluralize(counts.critical || 1, 'alarme', 'alarmes')}`
      : status === 'warning'
        ? `Alerta · ${pluralize(counts.warning, 'alarme', 'alarmes')}`
        : 'Normal · sem alarmes';

  return (
    <header className="sticky top-0 z-40 border-b border-line-strong bg-surface">
      {/* Faixa institucional */}
      <div className="flex items-center gap-4 border-b border-line px-6 py-2">
        <SenaiLogo />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-brand">{PLANT.systemName}</h1>
          <p className="truncate text-xs text-ink-muted">Equipamento <span className="font-mono font-medium text-ink-default">{PLANT.equipmentId}</span> · Mundo SENAI</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-ink-default">
            <User className="size-4 text-ink-muted" aria-hidden />
            <span>{PLANT.operator}</span>
          </div>
          <div className="text-right num">
            <div className="text-lg font-semibold leading-tight text-ink">{formatTime(plant.now)}</div>
            <div className="text-xs text-ink-muted">{formatDate(plant.now)}</div>
          </div>
        </div>
      </div>

      {/* Faixa de estado do processo */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-sunken px-6 py-2">
        <Field label="Lote">
          <span className="font-mono">{s?.batch.lot ?? '—'}</span>
        </Field>
        <Field label="Etapa atual" className="min-w-36">
          {s ? `${s.batch.phaseIndex + 1}/${PHASES.length} · ${PHASES[s.batch.phaseIndex].name}` : '—'}
        </Field>
        <Field label="Tempo do lote">
          <span className="num">{s ? formatDuration(batchElapsedS) : '—'}</span>
        </Field>
        <Field label="Processo">
          {batchStatus ? <StatusBadge status={batchStatus.badge} label={batchStatus.label} /> : '—'}
        </Field>
        <Field label="Status geral">
          <StatusBadge status={status} label={statusLabel} size="md" />
        </Field>
        <Field label="Comunicação CLP">
          <div className="flex items-center gap-2">
            {plant.comm === 'online' ? (
              <StatusBadge status="normal" icon={Wifi} label="Online" />
            ) : plant.comm === 'offline' ? (
              <StatusBadge status="critical" icon={WifiOff} label="Offline" />
            ) : (
              <StatusBadge status="transition" label="Conectando" />
            )}
            <span className={cn('text-xs num', plant.comm === 'offline' ? 'font-semibold text-st-critical-text' : 'text-ink-muted')}>
              {ageS === null ? 'sem leitura' : `última leitura há ${ageS} s`}
            </span>
            {simulation && (
              <span className="rounded border border-dashed border-line-strong px-1.5 py-0.5 text-[11px] text-ink-muted num">
                Simulação ×{simulation.acceleration}
              </span>
            )}
          </div>
        </Field>
        <div className="ml-auto flex items-center border-l border-line-strong pl-5">
          <EmergencyButton status={s?.batch.status ?? null} />
        </div>
      </div>
    </header>
  );
}
