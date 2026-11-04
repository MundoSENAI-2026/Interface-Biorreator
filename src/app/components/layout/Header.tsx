import { MonitorPlay, Radio, User, Wifi, WifiOff } from 'lucide-react';
import { MQTT, PHASES, PLANT } from '../../config/plant';
import { PROJECT } from '../../config/project';
import { overallStatus, type PlantState } from '../../data/store';
import { mqttSource, simulation } from '../../data/source';
import type { BatchStatus } from '../../data/types';
import { formatDate, formatDuration, formatTime, pluralize } from '../../lib/format';
import { EmergencyButton } from '../dashboard/EmergencyButton';
import { BrandLogo } from './BrandLogo';
import { StatusBadge, type BadgeStatus } from '../hmi/StatusBadge';
import { cn } from '../ui/utils';

const BATCH_STATUS: Record<BatchStatus, { label: string; badge: BadgeStatus }> = {
  idle: { label: 'Aguardando início', badge: 'stopped' },
  running: { label: 'Automático · em execução', badge: 'running' },
  stopped: { label: 'Parado · modo manual', badge: 'stopped' },
  emergency: { label: 'Emergência', badge: 'critical' },
  completed: { label: 'Lote concluído', badge: 'stopped' },
};

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex shrink-0 flex-col justify-center gap-0.5', className)}>
      <span className="text-[13px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      <div className="whitespace-nowrap text-base font-medium text-ink">{children}</div>
    </div>
  );
}

export function Header({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const status = overallStatus(plant);
  const activeAlarms = plant.alarms.filter((a) => a.state !== 'normalized');
  const unacknowledged = plant.alarms.filter((a) => a.state !== 'acknowledged').length;
  const counts = {
    critical: activeAlarms.filter((a) => a.priority === 'critical').length,
    warning: activeAlarms.filter((a) => a.priority === 'warning').length,
  };
  const ageS = plant.lastReadAt ? Math.max(0, Math.round((plant.now - plant.lastReadAt) / 1000)) : null;
  const batchStatus = s ? BATCH_STATUS[s.batch.status] : null;
  const batchElapsedS = s
    ? s.batch.phaseDurationsS.reduce<number>((acc, d) => acc + (d ?? 0), 0) + (s.batch.status === 'completed' ? 0 : s.batch.phaseElapsedS)
    : 0;

  const pendingLabel = unacknowledged ? ` · ${unacknowledged} não reconhecido${unacknowledged === 1 ? '' : 's'}` : '';
  const statusLabel = status === 'critical'
    ? `Crítico · ${pluralize(counts.critical || 1, 'alarme', 'alarmes')}${pendingLabel}`
    : status === 'warning'
      ? `Alerta · ${pluralize(counts.warning, 'alarme', 'alarmes')}${pendingLabel}`
      : unacknowledged ? `Normal${pendingLabel}` : 'Normal · sem alarmes';

  return (
    <header className="sticky top-0 z-40 border-b border-line-strong bg-surface">
      {/* Faixa institucional */}
      <div className="flex items-center gap-4 border-b border-line px-6 py-1.5">
        <BrandLogo />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-brand">{PLANT.systemName}</h1>
          <p className="truncate text-sm text-ink-muted">Equipamento <span className="font-mono font-medium text-ink-default">{PLANT.equipmentId}</span> · {PROJECT.event}</p>
        </div>
        <div className="ml-auto flex items-center gap-6">
          {(simulation || mqttSource) && (
            <span className={cn('group relative inline-flex items-center gap-1.5 rounded border border-line-strong px-2 py-1 text-sm text-ink-muted', simulation && 'border-dashed')}>
              {simulation ? <MonitorPlay className="size-4" aria-hidden /> : <Radio className="size-4" aria-hidden />}
              {simulation ? 'Simulação' : 'Ao vivo · MQTT'}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-[13px] text-ink-default opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 num"
              >
                {simulation
                  ? `Dados simulados · velocidade ×${simulation.acceleration}`
                  : `${MQTT.host}:${MQTT.port} · ${mqttSource?.dataTopic}`}
              </span>
            </span>
          )}
          <div className="flex items-center gap-2 text-base text-ink-default">
            <User className="size-4 text-ink-muted" aria-hidden />
            <span>{PLANT.operator}</span>
          </div>
          <div className="text-right num">
            <div className="text-2xl font-semibold leading-tight text-ink">{formatTime(plant.now)}</div>
            <div className="text-sm text-ink-muted">{formatDate(plant.now)}</div>
          </div>
        </div>
      </div>

      {/* Faixa de estado do processo */}
      <div className="flex items-center gap-x-4 bg-sunken px-6 py-1.5 2xl:gap-x-6">
        <Field label="Lote">
          <span className="font-mono">{s?.batch.lot ?? '—'}</span>
        </Field>
        <Field label="Etapa atual" className="min-w-36">
          {s ? `${s.batch.phaseIndex + 1}/${PHASES.length} · ${PHASES[s.batch.phaseIndex].name}` : '—'}
        </Field>
        <Field label="Tempo do lote" className="hidden 2xl:flex">
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
              <StatusBadge status="normal" icon={Wifi} label={mqttSource ? 'Online · MQTT' : 'Online'} />
            ) : plant.comm === 'offline' ? (
              <StatusBadge status="critical" icon={WifiOff} label="Offline" />
            ) : plant.comm === 'reconnecting' ? (
              <StatusBadge status="transition" label="Reconectando…" />
            ) : (
              <StatusBadge status="transition" label="Conectando" />
            )}
            <span className={cn('text-sm num', plant.comm === 'offline' ? 'font-semibold text-st-critical-text' : 'text-ink-muted')}>
              {ageS === null ? (mqttSource ? 'sem mensagem' : 'sem leitura') : (
                <>
                  <span className="hidden 2xl:inline">{mqttSource ? 'última mensagem' : 'última leitura'} </span>há {formatDuration(ageS)}
                </>
              )}
            </span>
          </div>
        </Field>
        <div className="ml-auto flex shrink-0 items-center border-l border-line-strong pl-4 2xl:pl-6">
          <EmergencyButton status={s?.batch.status ?? null} />
        </div>
      </div>
    </header>
  );
}
