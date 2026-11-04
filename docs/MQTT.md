# Fonte de dados MQTT (Paho)

A IHM do BR-100 pode receber os dados do biorreator de três fontes:

| Fonte | O que é | Cabeçalho mostra |
|---|---|---|
| **Simulação** (padrão) | Simulador interno, sem internet | `Simulação` |
| **MQTT (equipeDEV)** | Mensagens JSON publicadas à mão no broker HiveMQ (seções 1 a 4) | `Ao vivo · MQTT` |
| **Biorreator real** | Tópico do equipamento real, publicado por um servidor Node-RED. **Somente leitura** (seção 6) | `Ao vivo · Biorreator real` |

**Como trocar:** pressione **Ctrl + Shift + F9** para abrir o painel de simulação. Em
**Fonte de dados**, escolha a fonte. A página recarrega, e o histórico e os alarmes
começam do zero. A escolha fica salva neste navegador. O valor padrão fica em
`src/app/config/plant.ts` → `DATA_SOURCE.active` (`'simulacao' | 'mqtt' | 'real'`).

---

## 1. Como a conexão funciona

Usamos a **mesma biblioteca e o mesmo broker** do exemplo do LED
([jmr230584/pratica-001-iot-led](https://github.com/jmr230584/pratica-001-iot-led)):
Paho MQTT (`mqttws31.js`), `broker.hivemq.com`, porta `8884`, `useSSL: true`.

O navegador não fala MQTT "puro" (TCP). Ele conversa com o broker por **WebSocket
seguro** (`wss://broker.hivemq.com:8884/mqtt`). É isso que o Paho faz por baixo.

### Comparação com o `script.js` do professor

| | `script.js` (LED) | IHM BR-100 (`src/app/data/pahoMqttSource.ts`) |
|---|---|---|
| Biblioteca | `<script src="mqttws31.js">` | O mesmo arquivo, copiado em `public/vendor/mqttws31.js` e carregado no `index.html` antes do app (funciona sem CDN) |
| Cliente | `new Paho.MQTT.Client("broker.hivemq.com", 8884, clientId)` | Igual, com host e porta vindos de `MQTT` em `config/plant.ts` |
| clientId | `"ESP8266" + Math.floor(Math.random()*900) + 100` gera textos como `ESP8266523100`, porque o `+ 100` é **colado** como texto | `"BR100-" + (100000 + Math.floor(Math.random()*900000))`: a soma é feita **antes** de juntar ao texto, ex.: `BR100-482913`. Com 6 dígitos, fica difícil dois computadores sortearem o mesmo número (no broker, um clientId repetido derruba a outra conexão) |
| Conectar | `connect({ useSSL: true, timeout: 5, onSuccess, onFailure })` | Igual, mais `keepAliveInterval: 30` (o "ping" que detecta queda) |
| Resultado | `alert("Conectado com sucesso!!")` | Sem `alert()`: o indicador **Comunicação** do cabeçalho mostra `Conectando`, `Online · MQTT`, `Reconectando…` ou `Offline`, e o histórico (F4) registra cada mudança |
| Queda | não trata | `onConnectionLost` → reconecta sozinho, esperando **2 s, 4 s, 8 s, 16 s e depois 30 s** entre tentativas. Ao chegar nos 30 s, o cabeçalho mostra `Offline` e o alarme "Falha de comunicação" é ativado. Ao conectar, a espera volta a 2 s |
| Receber | não recebe | Ao conectar, **assina** `<prefixo>dados` e trata cada mensagem em `onMessageArrived` |
| Enviar | `new Paho.MQTT.Message("")` em `senai661/led/on` | `new Paho.MQTT.Message(JSON)` em `<prefixo>cmd/<TAG>/<acao>` (ver seção 3) |

**Sem mensagens não é falha.** Como os valores são publicados à mão, a IHM pode
ficar minutos sem receber nada, e a comunicação continua *Online*. O que muda é a
**idade** de cada valor: passe o mouse sobre um valor para ver "atualizado há X".
Acima de **10 min** (`MQTT.staleAfterMin`), o valor fica **cinza**, marcado como
"Dado antigo". Um valor que nunca chegou aparece como "—", com a etiqueta "Aguardando
dados" e o aviso "Aguardando dados do equipamento". Válvulas, motor, bomba e porta que
nunca chegaram aparecem como "Sem dado".

### Configuração (`src/app/config/plant.ts`)

```ts
export const DATA_SOURCE = { active: 'simulacao' };   // 'simulacao' | 'mqtt'

export const MQTT = {
  host: 'broker.hivemq.com',
  port: 8884,
  useSSL: true,
  topicPrefix: 'senai661/br100-equipeDEV/',
  clientIdPrefix: 'BR100-',
  timeoutS: 5,
  keepAliveS: 30,
  reconnectMinS: 2,
  reconnectMaxS: 30,
  staleAfterMin: 10,
  rpmMax: 300,
};
```

> ⚠️ O broker `broker.hivemq.com` é **público**: qualquer pessoa que souber o
> tópico pode ler e publicar nele. O prefixo é só um "nome", não uma senha. Serve
> para aula e demonstração. Não use com equipamento real.

---

## 2. Tópicos

Prefixo: `senai661/br100-equipeDEV/`

| Tópico | Direção | Conteúdo |
|---|---|---|
| `senai661/br100-equipeDEV/dados` | broker → IHM | Estado da planta em JSON (seção 3) |
| `senai661/br100-equipeDEV/cmd/<TAG>/<acao>` | IHM → broker | Comando do operador |

### Comandos publicados pela IHM

| Botão na IHM | Tópico (depois do prefixo) |
|---|---|
| START / STOP | `cmd/BR_100/iniciar` · `cmd/BR_100/parar` |
| Parada de emergência / Rearmar | `cmd/BR_100/emergencia` · `cmd/BR_100/rearmar` |
| Válvula XV-01 … XV-10 | `cmd/XV_100_05/abrir` · `cmd/XV_100_05/fechar` |
| Motor do agitador | `cmd/M_100_01/ligar` · `cmd/M_100_01/desligar` |
| Bomba de transferência | `cmd/P_100_01/ligar` · `cmd/P_100_01/desligar` |
| Porta de visita | `cmd/ZS_100_01/abrir` · `cmd/ZS_100_01/fechar` |

Conteúdo de todo comando:

```json
{"usuario":"Operador 01","timestamp":"2026-11-04T11:35:51.305Z"}
```

O comando fica registrado no histórico (F4) como *Comando* do operador e como
*Comando publicado em …*. **A tela não muda ao clicar.** O motor só aparece como
desligado quando chegar em `dados` uma mensagem com `"M_100_01": {"ligado": false}`.
É o mesmo modelo de uma planta real: quem confirma o estado é o CLP/ESP, não a IHM.

Os intertravamentos da IHM continuam valendo. Por exemplo, os comandos manuais só
são liberados com o processo **parado**, e o agitador não liga com nível abaixo de 20 %.

---

## 3. Formato do JSON (`<prefixo>dados`)

A mensagem é **um objeto JSON** e pode ser **parcial**: mande só as tags que
mudaram. As outras continuam com o último valor recebido.

| Chave | Tipo | Exemplo | Escala aceita |
|---|---|---|---|
| `TIT_100_01` (temperatura) | número | `37.5` | 0 a 150 °C |
| `PIT_100_01` (pressão) | número | `0.15` | 0 a 2 kgf/cm² |
| `LIT_100_01` (nível) | número | `70` | 0 a 100 % |
| `AIT_100_01` (pH) | número | `6.8` | 0 a 14 |
| `XV_100_01` … `XV_100_10` (válvulas) | texto | `"aberta"` ou `"fechada"` | |
| `ZS_100_01` (porta de visita) | texto | `"aberta"` ou `"fechada"` | |
| `M_100_01` (motor do agitador) | objeto | `{"ligado": true, "rpm": 120}` | rpm de 0 a 300 |
| `P_100_01` (bomba) | objeto | `{"ligado": false}` | `rpm` é aceito e ignorado |
| `etapa` | número inteiro | `10` | 1 a 11 |
| `processo` | texto | `"parado"` | `"aguardando"`, `"automatico"`, `"parado"`, `"emergencia"`, `"concluido"` |

Observações:

- Use **ponto** como separador decimal (`37.5`), como todo JSON. Na tela, o valor aparece como `37,5`.
- Em `M_100_01` e `P_100_01`, os dois campos são opcionais (mande ao menos um).
  `{"ligado": false}` sem `rpm` zera a rotação.
- `processo` é uma chave extra, criada porque a IHM só libera os comandos manuais
  com o processo parado. Antes de receber essa chave, a IHM considera `"parado"`.
- Os **limites de alarme dependem da etapa**. Exemplo: na etapa 10 (Fermentação),
  a temperatura dá alerta acima de 39 °C e alarme crítico acima de 41 °C.
- As 11 etapas: 1 Abastecimento · 2 Agitação · 3 Check Pressão · 4 Alívio Pressão ·
  5 Esterilização · 6 Resfriamento · 7 Cultura · 8 Mistura · 9 Microrganismo ·
  10 Fermentação · 11 Fim Produção.

### Mensagens inválidas

A tela nunca quebra. Nestes casos o valor é **ignorado** e o histórico (F4) registra
**"Mensagem MQTT inválida"** com o motivo:

- texto que não é JSON (`{oops`), lista (`[1,2]`) ou objeto vazio (`{}`);
- tag desconhecida (`"TIT_999": 1`);
- tipo errado (`"XV_100_01": "meio aberta"`, `"M_100_01": {"ligado": "sim"}`);
- valor fora da escala (`"TIT_100_01": 999`).

Se só **parte** da mensagem estiver errada, a parte certa é aplicada. Exemplo:
`{"TIT_100_01": 999, "LIT_100_01": 71.5}` atualiza o nível e recusa a temperatura.

---

## 4. Testando com o MQTT Explorer

1. Abra a IHM, pressione **Ctrl + Shift + F9** e escolha **MQTT**. Espere o cabeçalho mostrar `Online · MQTT`.
2. No [MQTT Explorer](https://mqtt-explorer.com/), crie uma conexão:
   - **Host:** `broker.hivemq.com` · **Port:** `1883` · protocolo `mqtt://` · sem TLS.
   - O MQTT Explorer usa a porta TCP 1883, e a IHM usa WebSocket na 8884. É o
     **mesmo broker**, então as mensagens passam de um para o outro.
3. Em **Publish**, use o tópico `senai661/br100-equipeDEV/dados`, formato **json**,
   cole uma das mensagens abaixo e clique em **Publish**.
4. Para ver os comandos da IHM, assine `senai661/br100-equipeDEV/cmd/#`. O `#` pega todos os subtópicos.

> **Retain:** deixe desmarcado. Com *retain* ligado, o broker guarda a última
> mensagem e a entrega a todos que conectarem depois, inclusive em outros
> computadores. Para apagar uma mensagem retida, publique uma mensagem **vazia** com
> *retain* no mesmo tópico (a IHM registra essa mensagem vazia como inválida, o que é esperado).

### 5 mensagens prontas

**1. Estado inicial: fermentação normal, processo parado**

```json
{"etapa": 10, "processo": "parado", "TIT_100_01": 37.0, "PIT_100_01": 0.15, "LIT_100_01": 71.0, "AIT_100_01": 6.8, "M_100_01": {"ligado": true, "rpm": 120}, "P_100_01": {"ligado": false}, "XV_100_05": "aberta", "XV_100_08": "aberta", "ZS_100_01": "fechada"}
```

**2. Atualização parcial: só a temperatura e o pH**

```json
{"TIT_100_01": 37.8, "AIT_100_01": 6.75}
```

**3. Alarme de temperatura:** na etapa 10, acima de 41 °C é crítico. Aparece o alarme "Temperatura muito alta" e o status geral fica *Crítico*.

```json
{"etapa": 10, "TIT_100_01": 42.5}
```

Para normalizar, publique `{"TIT_100_01": 37.2}` e reconheça o alarme na IHM.

**4. Resposta a um comando:** desliga o agitador e fecha a aeração (como se o CLP tivesse executado `cmd/M_100_01/desligar` e `cmd/XV_100_05/fechar`).

```json
{"M_100_01": {"ligado": false, "rpm": 0}, "XV_100_05": "fechada"}
```

**5. Mensagem com erros:** testa o registro "Mensagem MQTT inválida". O nível é aplicado e o resto é recusado.

```json
{"TIT_100_01": 999, "LIT_100_01": 70.5, "XV_100_01": "meio aberta", "TAG_INEXISTENTE": 1}
```

---

## 5. Arquivos envolvidos

| Arquivo | Papel |
|---|---|
| `public/vendor/mqttws31.js` | Biblioteca Paho MQTT, cópia do repositório do professor |
| `index.html` | Carrega a biblioteca antes do app |
| `src/types/paho.d.ts` | Diz ao TypeScript o formato de `window.Paho.MQTT` |
| `src/app/data/pahoLink.ts` | Conexão com o broker: conectar, reconectar e assinar os tópicos (usada pelas duas fontes MQTT) |
| `src/app/data/pahoMqttSource.ts` | Fonte equipeDEV: leitura do JSON e publicação dos comandos |
| `src/app/data/realBioreactorSource.ts` | Fonte biorreator real: etapas e variáveis analógicas dos tópicos appiot, somente leitura |
| `src/app/data/source.ts` | Escolhe a fonte e faz a troca |
| `src/app/config/plant.ts` | `DATA_SOURCE`, `MQTT` e `REAL_EQUIPMENT`: broker, porta, tópicos, tempos |

---

## 6. Biorreator real (`senai661/appiot/biorreator`)

Um servidor com Node-RED publica o estado do equipamento real neste tópico. Mesmo
broker e mesma porta (`broker.hivemq.com:8884`, `useSSL`). A conexão é a mesma
`PahoLink` das outras fontes MQTT.

### Formato observado

Uma chave por mensagem, em JSON. Em 04/11/2026, o servidor mandava as 12 chaves em
sequência **a cada ~1 s** (cerca de 12 mensagens por segundo), sem *retain*:

```json
{"Produção":true}
{"1_Abastecimento_ok":true}
{"2_Agitação_ok":true}
{"3_Check_Pressão_ok":false}
{"4_Alivio_Pressão_ok":false}
{"5_Esterilização_ok":false}
{"6_Resfriamento_ok":false}
{"7_Adição_Cultura_ok":false}
{"8_Mistura_Calda_ok":false}
{"9_Adição_Micro_ok":false}
{"10_Fermentação_Temp":false}
{"11_Fim_Produção":false}
```

### Como a IHM interpreta

- **Acumula** o estado: cada mensagem atualiza só a sua chave, e as outras continuam valendo.
- **Etapas pelo número** no início da chave (`^(\d{1,2})_`), não pelo texto. Assim,
  acentos e nomes diferentes (`Alivio`/`Alívio`, `Fermentação_Temp`) não atrapalham.
  `true` = etapa concluída.
- **Etapa atual** = a primeira etapa `false` depois da última concluída. Uma etapa que
  ainda não chegou não segura a sequência. Se a última etapa (11) for `true`, a tela mostra **Lote concluído**.
- **`Produção`**: `true` = *Automático · em execução*; `false` = *Parado*. A comparação
  ignora acento e maiúsculas (`"Producao"` também vale).
- **Horário das etapas** (barra de etapas da Visão Geral):
  - `Concluída · 09:55:59` quando a IHM viu a etapa passar de `false` para `true`;
  - `Concluída · até 09:52` quando a etapa já estava concluída ao conectar (a hora exata é desconhecida; o tooltip explica).
- **Aquecimento**: ao conectar, a tela espera um ciclo completo de chaves (a primeira
  chave repetida, cerca de 1 s) antes de mostrar o estado. Isso evita registrar no
  histórico mudanças de etapa que não aconteceram. Se o tópico das etapas estiver
  mudo, a espera vai até `warmupS` (15 s), e então a tela mostra só as analógicas.

### Histórico sem repetição

O servidor repete tudo a cada segundo, mas o histórico só registra **mudanças**:

- `Estado inicial: produção em execução · etapa 3 (Check Pressão) em curso` (uma vez, ao conectar);
- `Etapa 3 (Check Pressão) concluída`, `Produção iniciada`, `Produção parada`;
- `Campo novo recebido: <nome>`: chave desconhecida, uma única vez por chave. O valor é guardado e a tela não quebra;
- `Valor inesperado em <chave>…`, `Mensagem inválida no tópico…`, `Chave "…" chegou com hífen`,
  `PIT_100_01 fora da escala: 3,00 kgf/cm² (escala 0–2) · leitura ignorada` e `Mensagem retida ignorada…`: uma única vez cada.

No histórico (F4), todos os eventos de comunicação têm origem **CLP** e usuário **Sistema**.

### Variáveis analógicas (`senai661/appiot/biorreator/a`)

Temperatura, pressão, nível e pH chegam em outro tópico (`REAL_EQUIPMENT.analogTopic`),
cerca de 1 vez por segundo, como **lista com um objeto**:

```json
[{"PIT_100_01":0,"LIT_100_01":0,"TIT_100_01":27.000144958496094,"AIT_100-01":7.595485687255859}]
```

- **Lista ou objeto**: se vier lista, a IHM junta todos os objetos dela. Se o JSON vier
  dentro de um texto (`"[{\"PIT_100_01\":0}]"`), ele é lido de novo.
- **Nomes das chaves**: `-` vira `_` e os espaços saem, então `AIT_100-01` vira
  `AIT_100_01`. A IHM registra uma vez no histórico: *Chave "AIT_100-01" chegou com hífen*.
- **Mapeamento** em `REAL_EQUIPMENT.tagKeys`: as quatro chaves já têm o nome da tag
  (`TIT_100_01` → `TIT_100_01`…). Um nome diferente no futuro é só mais uma linha.
- **Valor completo**: a IHM guarda `27.000144958496094` e a tela arredonda pelas casas
  decimais da tag (27,0 °C). **0 é um valor válido.**
- **Fora da escala** (ex.: pressão 3,0 com escala 0 a 2 kgf/cm²): a leitura é ignorada e
  registrada uma vez no histórico. O card fica cinza com a etiqueta *Fora da escala* e
  mostra o valor recebido.
- Os cards funcionam como no simulador: valor, mini gráfico, tendência e alarmes pelos
  limites da etapa atual.
- **Watchdog próprio**: mais de 10 s sem mensagens no `/a` (`analogSilenceTimeoutS`)
  deixa **só os cards analógicos** em cinza, com *Dado antigo · atualizado há 14 s*. As
  etapas seguem o watchdog delas, e um não derruba o outro.

### Mensagens retidas

Em 04/11/2026 havia uma mensagem **retida** `{"TIT_100_01": 58}` nos dois tópicos appiot.
Ela não veio do servidor do equipamento, que não usa *retain*: alguém a publicou à mão.
O broker a entrega a cada conexão, e ela daria um alarme falso de temperatura. Por isso
a IHM **ignora mensagens retidas** nesta fonte e registra o aviso uma vez no histórico.
Para apagá-la do broker, publique uma mensagem **vazia com retain** no mesmo tópico
(MQTT Explorer → payload vazio + "retain" → Publish).

### Segurança: somente leitura

- A IHM **nunca publica** no tópico appiot. A fonte não tem comando de envio, e a conexão
  é criada em modo somente leitura. No teste, a IHM enviou ao broker apenas a conexão
  e as assinaturas dos dois tópicos: **nenhum PUBLISH**.
- Todos os comandos ficam desabilitados com o aviso **"Supervisão do equipamento real ·
  somente leitura"**: START/STOP, motor, bomba, válvulas, porta e também a **parada de
  emergência** (o tooltip orienta usar a parada de emergência física do equipamento).

### Comunicação

| Situação | Cabeçalho |
|---|---|
| Mensagens de etapas chegando | `Online · equipamento real` |
| Broker conectado, mas **mais de 10 s sem mensagens de etapas** (`REAL_EQUIPMENT.silenceTimeoutS`) | `Sem dados do equipamento` + alarme crítico "Falha de comunicação". Os cards analógicos continuam funcionando enquanto o `/a` chegar |
| **Mais de 10 s sem mensagens no `/a`** (`analogSilenceTimeoutS`) | Cabeçalho inalterado; só os cards analógicos ficam cinza com *Dado antigo* |
| Conexão com o broker caiu | `Reconectando…` / `Offline` (igual às outras fontes) |

Aqui o "watchdog" faz sentido porque o servidor publica a cada segundo. Na fonte
equipeDEV não existe esse limite, porque lá os valores são publicados à mão.
