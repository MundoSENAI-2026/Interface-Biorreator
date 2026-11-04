import { MonitorPlay, Radio, User, Wifi, WifiOff } from 'lucide-react';
import { MQTT, PHASES, PLANT } from '../../config/plant';
import { PROJECT } from '../../config/project';
import { overallStatus, type PlantState } from '../../data/store';
import { mqttSource, realSource, simulation } from '../../data/source';
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

/** Selo da fonte de dados no cabeçalho (texto + tooltip). */
function sourceBadge(): { label: string; detail: string } | null {
  if (simulation) return { label: 'Simulação', detail: `Dados simulados · velocidade ×${simulation.acceleration}` };
  if (mqttSource) return { label: 'Ao vivo · MQTT', detail: `${MQTT.host}:${MQTT.port} · ${mqttSource.dataTopic}` };
  if (realSource) return { label: 'Ao vivo · Biorreator real', detail: `${MQTT.host}:${MQTT.port} · ${realSource.topic} e /a · somente leitura` };
  return null;
}

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
  const source = sourceBadge();
  const status = overallStatus(plant);
  const activeAlarms = plant.alarms.filter((a) => a.state !== 'normalized');
  const unacknowledged = plant.alarms.filter((a) => a.state !== 'acknowledged').length;
  // Biorreator real: idade das mensagens de etapas (as analógicas têm watchdog próprio, nos cards)
  const lastAt = realSource ? realSource.lastPhaseMessageAt : plant.lastReadAt;
  const ageS = lastAt ? Math.max(0, Math.round((plant.now - lastAt) / 1000)) : null;
  const batchStatus = s ? BATCH_STATUS[s.batch.status] : null;
  const batchElapsedS = s
    ? s.batch.phaseDurationsS.reduce<number>((acc, d) => acc + (d ?? 0), 0) + (s.batch.status === 'completed' ? 0 : s.batch.phaseElapsedS)
    : 0;

  // Uma linha só: "Crítico · 3 pendentes" (pendente = ainda não reconhecido)
  const level = status === 'critical' ? 'Crítico' : status === 'warning' ? 'Alerta' : 'Normal';
  const statusLabel = unacknowledged
    ? `${level} · ${pluralize(unacknowledged, 'pendente', 'pendentes')}`
    : activeAlarms.length
      ? `${level} · ${pluralize(activeAlarms.length, 'alarme', 'alarmes')}`
      : status === 'critical' ? 'Crítico · sem comunicação' : 'Normal · sem alarmes';

  // Comunicação: um selo, uma frase ("Online · há 1 s", "Sem dados há 25 s")
  const age = ageS === null ? null : formatDuration(ageS);
  const lastTitle = lastAt ? `${simulation ? 'Última leitura' : 'Última mensagem'} às ${formatTime(lastAt)}` : undefined;
  const comm = plant.comm === 'online'
    ? <StatusBadge status="normal" icon={Wifi} label={age ? `Online · há ${age}` : 'Online'} title={lastTitle} className="num" />
    : plant.comm === 'silent'
      ? <StatusBadge status="critical" icon={WifiOff} label={age ? `Sem dados há ${age}` : 'Sem dados do equipamento'} title={lastTitle} className="num" />
      : plant.comm === 'offline'
        ? <StatusBadge status="critical" icon={WifiOff} label={age ? `Sem conexão há ${age}` : 'Sem conexão'} title={lastTitle} className="num" />
        : <StatusBadge status="transition" label={plant.comm === 'reconnecting' ? 'Reconectando…' : 'Conectando…'} />;
  const waiting = <span className="text-ink-muted">Aguardando…</span>;

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
          {source && (
            <span className={cn('group relative inline-flex items-center gap-1.5 rounded border border-line-strong px-2 py-1 text-sm text-ink-muted', simulation && 'border-dashed')}>
              {simulation ? <MonitorPlay className="size-4" aria-hidden /> : <Radio className="size-4" aria-hidden />}
              {source.label}
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-50 mt-1 whitespace-nowrap rounded border border-line bg-surface px-2 py-1 text-[13px] text-ink-default opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 num"
              >
                {source.detail}
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
          {!s ? waiting : s.batch.lot ? <span className="font-mono">{s.batch.lot}</span> : <span className="text-ink-muted">Não informado</span>}
        </Field>
        <Field label="Etapa atual" className="min-w-36">
          {s ? `${s.batch.phaseIndex + 1}/${PHASES.length} · ${PHASES[s.batch.phaseIndex].name}` : waiting}
        </Field>
        <Field label="Tempo do lote" className="hidden 2xl:flex">
          {s ? <span className="num">{formatDuration(batchElapsedS)}</span> : waiting}
        </Field>
        <Field label="Processo">
          {batchStatus ? <StatusBadge status={batchStatus.badge} label={batchStatus.label} /> : waiting}
        </Field>
        <Field label="Status geral">
          <StatusBadge status={status} label={statusLabel} size="md" />
        </Field>
        <Field label="Comunicação CLP">
          {comm}
        </Field>
        <div className="ml-auto flex shrink-0 items-center border-l border-line-strong pl-4 2xl:pl-6">
          <EmergencyButton status={s?.batch.status ?? null} />
        </div>
      </div>
    </header>
  );
}
