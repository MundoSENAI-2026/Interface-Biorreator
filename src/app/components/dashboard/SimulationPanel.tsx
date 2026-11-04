import { FlaskConical, Play, SkipForward, Square, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MQTT, SIMULATION, TAGS, TAG_ORDER, VALVES, type SourceKind, type TagId, type ValveId } from '../../config/plant';
import type { ForceLevel } from '../../data/simulator';
import { demoScenario } from '../../data/demoScenario';
import { activeSource, mqttSource, realSource, setActiveSource, simulation, usePlant } from '../../data/source';
import { useUi } from '../../data/ui';
import { cn } from '../ui/utils';

const LEVELS: { id: ForceLevel; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'warning', label: 'Alerta' },
  { id: 'critical', label: 'Crítico' },
];

function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded border border-line bg-sunken p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={String(o.id)}
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          className={cn('rounded px-2 py-0.5', o.id === value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Painel de testes. Oculto por padrão; abre com Ctrl + Shift + SIMULATION.panelShortcutKey
 * e fecha com Esc. Troca a fonte de dados; os demais testes só existem no simulador.
 */
export function SimulationPanel() {
  usePlant(); // atualiza junto com as leituras
  const { caption } = useUi();
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [faultValve, setFaultValve] = useState<ValveId>('XV_100_03');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === SIMULATION.panelShortcutKey.toUpperCase()) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) return null;
  const sim = simulation;
  const act = (fn: () => void) => {
    fn();
    force((n) => n + 1);
  };

  return (
    <aside
      aria-label="Painel de simulação"
      className="fixed bottom-4 left-4 z-50 flex max-h-[calc(100vh-2rem)] w-[24rem] flex-col overflow-auto rounded-md border-2 border-dashed border-line-strong bg-surface shadow-lg"
    >
      <header className="flex items-center justify-between border-b border-line px-4 py-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-ink-muted" aria-hidden />
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-default">Simulação · testes</h2>
        </div>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-ink-muted hover:bg-sunken" aria-label="Fechar painel de simulação">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex flex-col gap-4 p-4 text-sm">
        <section className="flex flex-col gap-2">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Fonte de dados</h3>
          <div className="flex items-center justify-between gap-2">
            <Segmented<SourceKind>
              value={activeSource}
              options={[
                { id: 'simulacao', label: 'Simulação' },
                { id: 'mqtt', label: 'MQTT (equipeDEV)' },
                { id: 'real', label: 'Biorreator real' },
              ]}
              onChange={(kind) => kind !== activeSource && setActiveSource(kind)}
            />
          </div>
          {realSource && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
              <dt className="text-ink-muted">Broker</dt>
              <dd className="break-all font-mono text-ink">{MQTT.host}:{MQTT.port}</dd>
              <dt className="text-ink-muted">Leituras</dt>
              <dd className="break-all font-mono text-ink" title={realSource.topic}>{realSource.topic}</dd>
              <dt className="text-ink-muted">Analógicas</dt>
              <dd className="break-all font-mono text-ink" title={realSource.analogTopic}>{realSource.analogTopic}</dd>
              <dt className="text-ink-muted">Comandos</dt>
              <dd className="text-ink">Somente leitura: nada é publicado</dd>
              <dt className="text-ink-muted">Chaves</dt>
              <dd className="text-ink">{realSource.received.size} recebidas</dd>
              <dt className="text-ink-muted">clientId</dt>
              <dd className="break-all font-mono text-ink">{realSource.clientId}</dd>
            </dl>
          )}
          {mqttSource && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[13px]">
              <dt className="text-ink-muted">Broker</dt>
              <dd className="break-all font-mono text-ink">{MQTT.host}:{MQTT.port}</dd>
              <dt className="text-ink-muted">Leituras</dt>
              <dd className="break-all font-mono text-ink" title={mqttSource.dataTopic}>{mqttSource.dataTopic}</dd>
              <dt className="text-ink-muted">Comandos</dt>
              <dd className="break-all font-mono text-ink">{MQTT.topicPrefix}cmd/&lt;TAG&gt;/&lt;ação&gt;</dd>
              <dt className="text-ink-muted">clientId</dt>
              <dd className="break-all font-mono text-ink">{mqttSource.clientId}</dd>
            </dl>
          )}
          <p className="text-[13px] text-ink-muted">A troca recarrega a página e recomeça histórico e alarmes.</p>
        </section>

        {sim && <>
        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Cenário de demonstração (~2 min)</h3>
          <p className="text-[13px] text-ink-muted">Normal → alerta → crítico → reconhecimento → intertravamento → normalização.</p>
          {caption ? (
            <button
              onClick={() => demoScenario.stop()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded border border-line-strong bg-surface text-sm text-ink hover:bg-sunken"
            >
              <Square className="size-4" aria-hidden />
              Encerrar cenário (passo {caption.step}/{caption.total})
            </button>
          ) : (
            <button
              onClick={() => demoScenario.start()}
              className="inline-flex h-9 items-center justify-center gap-2 rounded border border-brand bg-brand text-sm text-white hover:bg-brand-strong"
            >
              <Play className="size-4" aria-hidden />
              Iniciar cenário roteirizado
            </button>
          )}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Forçar variável (limites da etapa atual)</h3>
          {TAG_ORDER.map((tag: TagId) => (
            <div key={tag} className="flex items-center justify-between gap-2">
              <span className="text-ink">
                {TAGS[tag].name} <span className="font-mono text-xs text-ink-muted">{tag}</span>
              </span>
              <Segmented value={sim.forced[tag] ?? 'normal'} options={LEVELS} onChange={(l) => act(() => sim.force(tag, l))} />
            </div>
          ))}
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Comunicação e equipamentos</h3>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink">Comunicação com o CLP</span>
            <Segmented
              value={sim.commLost ? 'lost' : 'ok'}
              options={[{ id: 'ok', label: 'Online' }, { id: 'lost', label: 'Derrubar' }]}
              onChange={(v) => act(() => sim.setCommLost(v === 'lost'))}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <select
              value={faultValve}
              onChange={(e) => setFaultValve(e.target.value as ValveId)}
              className="h-7 rounded border border-line-strong bg-surface px-1.5 text-xs text-ink"
              aria-label="Válvula"
            >
              {VALVES.map((v) => (
                <option key={v.id} value={v.id}>{v.short} · {v.function}</option>
              ))}
            </select>
            <Segmented
              value={sim.faults.has(faultValve) ? 'fault' : 'ok'}
              options={[{ id: 'ok', label: 'Sem falha' }, { id: 'fault', label: 'Falha' }]}
              onChange={(v) => act(() => sim.setValveFault(faultValve, v === 'fault'))}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2 border-t border-line pt-3">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-ink-muted">Tempo de processo</h3>
          <div className="flex items-center justify-between gap-2">
            <span className="text-ink">Aceleração</span>
            <Segmented
              value={sim.acceleration}
              options={SIMULATION.accelerationOptions.map((f) => ({ id: f, label: `×${f}` }))}
              onChange={(f) => act(() => sim.setAcceleration(f))}
            />
          </div>
          <button
            onClick={() => act(() => sim.skipPhase())}
            className="inline-flex h-8 items-center justify-center gap-2 rounded border border-line-strong bg-surface text-sm text-ink hover:bg-sunken"
          >
            <SkipForward className="size-4" aria-hidden />
            Avançar para a próxima etapa
          </button>
        </section>
        </>}

        <p className="text-xs text-ink-muted">
          Atalho: Ctrl + Shift + {SIMULATION.panelShortcutKey} · Esc fecha. Os testes aparecem apenas com a fonte simulada.
        </p>
      </div>
    </aside>
  );
}
