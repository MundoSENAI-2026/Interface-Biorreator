import { MQTT } from '../config/plant';
import type { CommStatus } from './types';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface PahoLinkOptions {
  /** Tópicos assinados ao conectar. */
  topics: string[];
  /** true = publish() sempre recusa (equipamento real: somente leitura). */
  readOnly?: boolean;
  /**
   * Conteúdo da mensagem como texto (null se não for UTF-8 válido), o tópico em que
   * chegou e se é uma mensagem retida (guardada no broker, de idade desconhecida).
   */
  onMessage(text: string | null, topic: string, retained: boolean): void;
  onStatus(status: CommStatus): void;
  /** Evento de comunicação para o histórico. */
  onEvent(message: string): void;
}

/**
 * Conexão com o broker via Paho MQTT (public/vendor/mqttws31.js), no mesmo padrão
 * do exemplo do LED: Paho.MQTT.Client(host, porta, clientId) com useSSL. Assina os
 * tópicos e reconecta sozinha com espera crescente (2, 4, 8, 16, 30 s…).
 * Usada pelas fontes MQTT (equipeDEV) e biorreator real.
 */
export class PahoLink {
  /** Ex.: "BR100-482913" (número somado ANTES de juntar ao texto, ao contrário do exemplo). */
  readonly clientId = MQTT.clientIdPrefix + (100_000 + Math.floor(Math.random() * 900_000));

  private client: PahoMQTT.Client | null = null;
  private status: CommStatus = 'connecting';
  /** Falhas seguidas de conexão (zera ao conectar). */
  private failures = 0;
  /** Incrementa a cada tentativa: callbacks de clientes antigos são ignorados. */
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: PahoLinkOptions) {}

  get topics() {
    return this.options.topics;
  }

  get online() {
    return this.status === 'online' && this.client !== null;
  }

  start() {
    window.addEventListener('online', this.onBrowserOnline);
    this.connect();
  }

  stop() {
    this.generation += 1;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    window.removeEventListener('online', this.onBrowserOnline);
    try {
      this.client?.disconnect();
    } catch {
      // já desconectado
    }
    this.client = null;
  }

  /** Publica um texto. Devolve o motivo da recusa, ou null se publicou. */
  publish(topic: string, payload: string): string | null {
    if (this.options.readOnly) return 'Conexão somente leitura';
    const paho = window.Paho?.MQTT;
    if (!paho || !this.client || this.status !== 'online') return 'Sem conexão com o broker MQTT';
    const message = new paho.Message(payload);
    message.destinationName = topic;
    try {
      this.client.send(message);
    } catch (e) {
      return `Falha ao publicar no broker: ${errorText(e)}`;
    }
    return null;
  }

  private connect() {
    this.retryTimer = null;
    const paho = window.Paho?.MQTT;
    if (!paho) {
      this.options.onEvent('Biblioteca Paho MQTT não carregada (public/vendor/mqttws31.js)');
      this.setStatus('offline');
      return;
    }

    const gen = ++this.generation;
    const current = () => gen === this.generation;
    let client: PahoMQTT.Client;
    try {
      client = new paho.Client(MQTT.host, MQTT.port, this.clientId);
    } catch (e) {
      this.options.onEvent(`Não foi possível criar o cliente MQTT: ${errorText(e)}`);
      this.setStatus('offline');
      return;
    }

    client.onConnectionLost = (err) => {
      if (!current()) return;
      this.client = null;
      this.scheduleReconnect(`Conexão com o broker perdida (${err.errorMessage || 'sem detalhe'})`);
    };
    client.onMessageArrived = (msg) => {
      if (!current()) return;
      let text: string | null;
      try {
        text = msg.payloadString;
      } catch {
        text = null;
      }
      this.options.onMessage(text, msg.destinationName, msg.retained);
    };

    this.client = client;
    try {
      client.connect({
        useSSL: MQTT.useSSL,
        timeout: MQTT.timeoutS,
        keepAliveInterval: MQTT.keepAliveS,
        cleanSession: true,
        onSuccess: () => {
          if (!current()) return;
          this.failures = 0;
          for (const topic of this.topics) {
            client.subscribe(topic, {
              qos: 0,
              onFailure: (err) => this.options.onEvent(`Falha ao assinar ${topic}: ${err.errorMessage}`),
            });
          }
          this.options.onEvent(`Conectado a ${MQTT.host}:${MQTT.port} como ${this.clientId} · assinando ${this.topics.join(' e ')}`);
          this.setStatus('online');
        },
        onFailure: (err) => {
          if (!current()) return;
          this.client = null;
          this.scheduleReconnect(`Falha ao conectar em ${MQTT.host}:${MQTT.port} (${err.errorMessage || 'sem detalhe'})`);
        },
      });
    } catch (e) {
      this.client = null;
      this.scheduleReconnect(`Falha ao conectar: ${errorText(e)}`);
    }
  }

  /** Espera 2, 4, 8, 16 s… (até o máximo) e tenta de novo. No máximo, passa a "Offline". */
  private scheduleReconnect(reason: string) {
    this.failures += 1;
    const delayS = Math.min(MQTT.reconnectMinS * 2 ** (this.failures - 1), MQTT.reconnectMaxS);
    const next: CommStatus = delayS >= MQTT.reconnectMaxS ? 'offline' : 'reconnecting';

    // Registra só o início da queda e a passagem para offline (sem repetir a cada tentativa)
    if (this.failures === 1) this.options.onEvent(`${reason} · nova tentativa em ${delayS} s`);
    else if (next === 'offline' && this.status !== 'offline') {
      this.options.onEvent(`Sem conexão com o broker após ${this.failures} tentativas · nova tentativa a cada ${MQTT.reconnectMaxS} s`);
    }

    this.setStatus(next);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delayS * 1000);
  }

  /** A rede do computador voltou: a espera recomeça em 2 s e, se havia uma agendada, tenta já. */
  private onBrowserOnline = () => {
    if (this.status === 'online') return;
    this.failures = 0;
    if (!this.retryTimer) return; // tentativa em andamento: se falhar, a próxima já é em 2 s
    clearTimeout(this.retryTimer);
    this.connect();
  };

  private setStatus(status: CommStatus) {
    if (status === this.status) return;
    this.status = status;
    this.options.onStatus(status);
  }
}
