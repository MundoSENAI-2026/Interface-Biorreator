/**
 * Tipagem mínima da biblioteca Paho MQTT (public/vendor/mqttws31.js).
 * O arquivo é carregado por <script> no index.html e cria o objeto global
 * window.Paho.MQTT; aqui declaramos só o que o PahoMqttSource usa.
 */

declare namespace PahoMQTT {
  interface MQTTError {
    errorCode: number;
    errorMessage: string;
  }

  interface ConnectOptions {
    useSSL?: boolean;
    /** Tempo máximo para conectar (s). */
    timeout?: number;
    /** Intervalo do "ping" que mantém a conexão viva (s). */
    keepAliveInterval?: number;
    cleanSession?: boolean;
    onSuccess?: () => void;
    onFailure?: (error: MQTTError) => void;
  }

  interface SubscribeOptions {
    qos?: 0 | 1 | 2;
    onSuccess?: () => void;
    onFailure?: (error: MQTTError) => void;
  }

  interface Message {
    /** Conteúdo como texto (lança erro se não for UTF-8 válido). */
    readonly payloadString: string;
    destinationName: string;
    qos: 0 | 1 | 2;
    retained: boolean;
  }

  interface Client {
    connect(options: ConnectOptions): void;
    disconnect(): void;
    subscribe(filter: string, options?: SubscribeOptions): void;
    send(message: Message): void;
    isConnected(): boolean;
    onConnectionLost: (error: MQTTError) => void;
    onMessageArrived: (message: Message) => void;
  }

  interface Module {
    Client: new (host: string, port: number, clientId: string) => Client;
    Message: new (payload: string) => Message;
  }
}

interface Window {
  /** Presente só se public/vendor/mqttws31.js foi carregado. */
  Paho?: { MQTT: PahoMQTT.Module };
}
