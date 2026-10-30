import { ArrowRight, DoorClosed, DoorOpen, Info, Lock, Play, Power, PowerOff, Square } from 'lucide-react';
import { EQUIPMENT, PHASES, VALVES } from '../../config/plant';
import { plantStore } from '../../data/source';
import { formatNumber } from '../../lib/format';
import type { PlantState } from '../../data/store';
import { CommandButton } from '../hmi/CommandButton';
import { StatusBadge } from '../hmi/StatusBadge';
import { VALVE_STATE_LABEL, ValveControl, ValveGlyph } from '../hmi/ValveControl';
import { uiStore } from '../../data/ui';
import { cn } from '../ui/utils';

function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted', className)}>{children}</h3>;
}

function EquipmentRow({ name, tag, badge, children, dense }: { name: string; tag: string; badge: React.ReactNode; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className={cn('grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded border border-line px-3', dense ? 'py-1' : 'py-1.5')}>
      <div className={cn('flex min-w-0 items-center gap-x-3 gap-y-1', !dense && 'flex-wrap')}>
        <span className="text-[15px] font-medium text-ink">{name}</span>
        <span className="font-mono text-[13px] text-ink-muted">{tag}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

/**
 * valves='controls': comando de cada válvula (tela Sinótico);
 * valves='summary': só o estado das válvulas em grade compacta (Visão Geral).
 */
export function CommandPanel({ plant, valves = 'controls' }: { plant: PlantState; valves?: 'controls' | 'summary' }) {
  const s = plant.snapshot;
  const shared = plantStore.manualBlockReason();
  const status = s?.batch.status;
  const phaseName = s ? PHASES[s.batch.phaseIndex].name : '';
  const dense = valves === 'summary';
  const btn = dense ? 'sm' : 'md';

  return (
    <div className={cn('flex flex-col', dense ? 'gap-2.5' : 'gap-3')}>
      <section>
        {!dense && <SectionTitle>Processo</SectionTitle>}
        <div className="grid grid-cols-2 gap-3">
          <CommandButton
            size={btn}
            command={{ type: 'start' }}
            label={status === 'stopped' ? 'START · retomar' : 'START · novo lote'}
            icon={Play}
            variant="primary"
            confirm={{
              title: status === 'stopped' ? 'Retomar a sequência automática?' : 'Iniciar um novo lote?',
              description:
                status === 'stopped'
                  ? `A sequência retoma na etapa "${phaseName}" e reposiciona válvulas, motor e bomba conforme a receita.`
                  : 'Um novo lote será iniciado na etapa Abastecimento. Confira se o tanque está pronto.',
              confirmLabel: 'START',
            }}
          />
          <CommandButton
            size={btn}
            command={{ type: 'stop' }}
            label="STOP"
            icon={Square}
            confirm={{
              title: 'Parar a sequência automática?',
              description:
                'A sequência fica pausada na etapa atual e os equipamentos permanecem no estado em que estão. Os comandos manuais serão liberados.',
              confirmLabel: 'STOP',
            }}
          />
        </div>
      </section>

      {/* Único aviso de bloqueio comum (o cadeado aparece só aqui) */}
      {shared && (
        <div className="flex items-start gap-2 rounded border border-line bg-sunken px-3 py-1.5 text-sm text-ink-default" role="status">
          {status === 'running' ? <Info className="mt-0.5 size-4 shrink-0 text-st-info" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            <strong className="font-semibold">{dense ? 'Manual bloqueado:' : 'Comandos manuais bloqueados.'}</strong> {shared}.
          </span>
        </div>
      )}

      <section>
        {!dense && <SectionTitle>Equipamentos</SectionTitle>}
        <div className={cn('flex flex-col', dense ? 'gap-1.5' : 'gap-2')}>
          <EquipmentRow
            dense={dense}
            name={EQUIPMENT.motor.name}
            tag={EQUIPMENT.motor.short}
            badge={<StatusBadge status={s?.motorOn ? 'running' : 'stopped'} label={`${s?.motorOn ? 'Ligado' : 'Desligado'} · ${formatNumber(s?.motorRpm ?? 0, 0)} rpm`} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              size={btn}
              command={{ type: 'motor', on: !s?.motorOn }}
              label={s?.motorOn ? 'Desligar' : 'Ligar'}
              icon={s?.motorOn ? PowerOff : Power}
            />
          </EquipmentRow>
          <EquipmentRow
            dense={dense}
            name={EQUIPMENT.pump.name}
            tag={EQUIPMENT.pump.short}
            badge={<StatusBadge status={s?.pumpOn ? 'running' : 'stopped'} label={s?.pumpOn ? 'Ligada' : 'Desligada'} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              size={btn}
              command={{ type: 'pump', on: !s?.pumpOn }}
              label={s?.pumpOn ? 'Desligar' : 'Ligar'}
              icon={s?.pumpOn ? PowerOff : Power}
              confirm={
                s?.pumpOn
                  ? undefined
                  : {
                      title: 'Ligar a bomba de transferência?',
                      description: 'O produto será transferido pela XV-10. Confirme que o destino está pronto para receber.',
                      confirmLabel: 'Ligar bomba',
                    }
              }
            />
          </EquipmentRow>
          <EquipmentRow
            dense={dense}
            name={EQUIPMENT.manway.name}
            tag={EQUIPMENT.manway.short}
            badge={
              s?.manwayOpen
                ? <StatusBadge status="warning" icon={DoorOpen} label="Aberta" />
                : <StatusBadge status="stopped" icon={DoorClosed} label="Fechada" />
            }
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              size={btn}
              command={{ type: 'manway', open: !s?.manwayOpen }}
              label={s?.manwayOpen ? 'Fechar' : 'Abrir'}
              confirm={
                s?.manwayOpen
                  ? undefined
                  : {
                      title: 'Abrir a porta de visita?',
                      description: 'Confirme que o tanque está despressurizado, resfriado e que a área está liberada para acesso.',
                      confirmLabel: 'Abrir porta',
                    }
              }
            />
          </EquipmentRow>
        </div>
      </section>

      {valves === 'summary' && (
        <section>
          <div className="mb-1 flex items-center justify-between">
            <SectionTitle className="mb-0">Válvulas</SectionTitle>
            <button onClick={() => uiStore.navigate('synoptic')} className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              comandar na F2 <ArrowRight className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-1 2xl:grid-cols-4">
            {VALVES.map((v) => {
              const st = s?.valves[v.id] ?? 'closed';
              return (
                <li key={v.id} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm" title={`${v.short} — ${v.function}: ${v.description}`}>
                  <ValveGlyph state={st} className="h-3.5 w-5 shrink-0" />
                  <span className="font-mono font-medium text-ink">{v.short}</span>
                  <span className={cn('truncate', st === 'open' ? 'font-medium text-st-info' : st === 'fault' ? 'font-semibold text-st-warning-text' : 'text-ink-muted')}>
                    {VALVE_STATE_LABEL[st]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {valves === 'controls' && (
        <section>
          <SectionTitle>Válvulas</SectionTitle>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {VALVES.map((v) => (
              <ValveControl key={v.id} valve={v} state={s?.valves[v.id] ?? 'closed'} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
