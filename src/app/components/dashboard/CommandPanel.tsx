import { DoorClosed, DoorOpen, Info, Lock, Play, Power, PowerOff, Square } from 'lucide-react';
import { EQUIPMENT, PHASES, VALVES } from '../../config/plant';
import { plantStore } from '../../data/source';
import { formatNumber } from '../../lib/format';
import type { PlantState } from '../../data/store';
import { CommandButton } from '../hmi/CommandButton';
import { StatusBadge } from '../hmi/StatusBadge';
import { ValveControl } from '../hmi/ValveControl';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

function EquipmentRow({ name, tag, badge, children }: { name: string; tag: string; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded border border-line px-3 py-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[15px] font-medium text-ink">{name}</span>
        <span className="font-mono text-[13px] text-ink-muted">{tag}</span>
        {badge}
      </div>
      {children}
    </div>
  );
}

/** showValves=false: só comandos principais (processo e equipamentos), para a Visão Geral. */
export function CommandPanel({ plant, showValves = true }: { plant: PlantState; showValves?: boolean }) {
  const s = plant.snapshot;
  const shared = plantStore.manualBlockReason();
  const status = s?.batch.status;
  const phaseName = s ? PHASES[s.batch.phaseIndex].name : '';

  return (
    <div className="flex flex-col gap-3">
      <section>
        <SectionTitle>Processo</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <CommandButton
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
        <div className="flex items-start gap-2 rounded border border-line bg-sunken px-3 py-2 text-sm text-ink-default" role="status">
          {status === 'running' ? <Info className="mt-0.5 size-4 shrink-0 text-st-info" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            <strong className="font-semibold">Comandos manuais bloqueados.</strong> {shared}.
          </span>
        </div>
      )}

      <section>
        <SectionTitle>Equipamentos</SectionTitle>
        <div className="flex flex-col gap-2">
          <EquipmentRow
            name={EQUIPMENT.motor.name}
            tag={EQUIPMENT.motor.short}
            badge={<StatusBadge status={s?.motorOn ? 'running' : 'stopped'} label={`${s?.motorOn ? 'Ligado' : 'Desligado'} · ${formatNumber(s?.motorRpm ?? 0, 0)} rpm`} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              command={{ type: 'motor', on: !s?.motorOn }}
              label={s?.motorOn ? 'Desligar' : 'Ligar'}
              icon={s?.motorOn ? PowerOff : Power}
            />
          </EquipmentRow>
          <EquipmentRow
            name={EQUIPMENT.pump.name}
            tag={EQUIPMENT.pump.short}
            badge={<StatusBadge status={s?.pumpOn ? 'running' : 'stopped'} label={s?.pumpOn ? 'Ligada' : 'Desligada'} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
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

      {showValves && (
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
