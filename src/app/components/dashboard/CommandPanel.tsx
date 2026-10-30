import { DoorClosed, DoorOpen, Info, Lock, Play, Power, PowerOff, Square } from 'lucide-react';
import { EQUIPMENT, PHASES, VALVES } from '../../config/plant';
import { plantStore } from '../../data/source';
import type { PlantState } from '../../data/store';
import { CommandButton } from '../hmi/CommandButton';
import { StatusBadge } from '../hmi/StatusBadge';
import { ValveControl } from '../hmi/ValveControl';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{children}</h3>;
}

function EquipmentRow({ name, tag, badge, children }: { name: string; tag: string; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-1.5 rounded border border-line px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-medium text-ink">{name}</span>
          <span className="font-mono text-xs text-ink-muted">{tag}</span>
        </div>
        <div className="mt-1.5">{badge}</div>
      </div>
      {children}
    </div>
  );
}

export function CommandPanel({ plant }: { plant: PlantState }) {
  const s = plant.snapshot;
  const shared = plantStore.manualBlockReason();
  const status = s?.batch.status;
  const phaseName = s ? PHASES[s.batch.phaseIndex].name : '';

  return (
    <div className="flex flex-col gap-5">
      {/* Processo */}
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

      {shared && (
        <div className="flex items-start gap-2 rounded border border-line bg-sunken px-3 py-2 text-xs text-ink-default" role="status">
          {status === 'running' ? <Info className="mt-0.5 size-4 shrink-0 text-st-info" aria-hidden /> : <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />}
          <span>
            <strong className="font-semibold">Comandos manuais bloqueados.</strong> {shared}.
          </span>
        </div>
      )}

      {/* Equipamentos */}
      <section>
        <SectionTitle>Equipamentos</SectionTitle>
        <div className="flex flex-col gap-2">
          <EquipmentRow
            name={EQUIPMENT.motor.name}
            tag={EQUIPMENT.motor.id}
            badge={<StatusBadge status={s?.motorOn ? 'running' : 'stopped'} label={s?.motorOn ? 'Ligado' : 'Desligado'} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              sharedReason={shared}
              command={{ type: 'motor', on: !s?.motorOn }}
              label={s?.motorOn ? 'Desligar' : 'Ligar'}
              icon={s?.motorOn ? PowerOff : Power}
            />
          </EquipmentRow>
          <EquipmentRow
            name={EQUIPMENT.pump.name}
            tag={EQUIPMENT.pump.id}
            badge={<StatusBadge status={s?.pumpOn ? 'running' : 'stopped'} label={s?.pumpOn ? 'Ligada' : 'Desligada'} />}
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              sharedReason={shared}
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
            tag={EQUIPMENT.manway.id}
            badge={
              s?.manwayOpen
                ? <StatusBadge status="warning" icon={DoorOpen} label="Aberta" />
                : <StatusBadge status="stopped" icon={DoorClosed} label="Fechada" />
            }
          >
            <CommandButton
              className="contents"
              reasonClassName="col-span-full"
              sharedReason={shared}
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

      {/* Válvulas */}
      <section>
        <SectionTitle>Válvulas</SectionTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VALVES.map((v) => (
            <ValveControl key={v.id} valve={v} state={s?.valves[v.id] ?? 'closed'} sharedReason={shared} />
          ))}
        </div>
      </section>
    </div>
  );
}
