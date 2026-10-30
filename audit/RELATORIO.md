# Auditoria do supervisório BR-100

**Data:** 30/10/2026  
**Fase:** 1 — auditoria; nenhuma tela, regra de processo ou dado do simulador foi alterado.

## Resumo executivo

As seis telas foram abertas no Chromium com Playwright em 1920×1080 e 1366×768. Foram geradas 48 capturas: seis telas em estado normal por resolução e capturas dos estados de alerta, crítico, alarme reconhecido, perda de comunicação, lote concluído e manual liberado nas telas relevantes. O roteiro também simulou 10 horas de processo em 120 segundos a ×300 e concluiu três reinícios de lote.

Em 1920×1080, as telas normais cabem sem rolagem e não houve overflow horizontal. Em 1366×768, todas as telas precisam rolar dentro da área principal; os cards continuam acessíveis e não há rolagem horizontal. Nos estados de alarme, porém, notificações fixas cobrem conteúdo da F1 e chegam à faixa do rodapé. A F3 também colore quase toda a área do gráfico de temperatura como crítica.

TypeScript passou (`tsc --noEmit`) e o build passou. O build avisa que o chunk JavaScript principal tem cerca de 839 kB antes do gzip. Não há script de lint. O `npm audit` encontrou 9 vulnerabilidades na árvore de dependências: 1 crítica, 6 altas, 1 moderada e 1 baixa.

O teste acelerado ficou entre 60 e 62 FPS e 20–45 MB de heap JavaScript, sem crescimento monotônico observado durante os 120 segundos amostrados. Não houve requisições externas nem falhas de rede. O console registrou um warning do React/Radix ao abrir uma confirmação de comando.

## Método e evidências

- Capturas e métricas por resolução/estado: [`screens/`](screens/).
- Resultado estruturado do roteiro, rolagem, erros de console, rede, FPS, heap e reinícios: [`results.json`](results.json).
- Resultado completo do inventário de dependências: [`npm-audit.json`](npm-audit.json).
- Saídas de verificação: [`build.log`](build.log) e [`typecheck.log`](typecheck.log).
- Para reproduzir as capturas: `npm run audit:visual`.
- Para reproduzir a validação de apresentação: `node audit/check-presentation.mjs`.
- Browser: Chromium headless instalado pelo Playwright. Escala de pixels 1×; capturas representam a área visível do viewport, sem redimensionamento.

O modo apresentação foi verificado em 1920×1080: entrou e saiu de tela cheia, ocultou o cursor após 3 s e alternou de F1 para F2 após o intervalo configurado. Evidência visual: [`screens/presentation/presentation-mode.png`](screens/presentation/presentation-mode.png); medições: [`presentation-results.json`](presentation-results.json).

### Resultado de layout

| Viewport | Capturas | Rolagem vertical da área principal | Overflow horizontal |
|---|---:|---:|---:|
| 1920×1080 | 24 | 0/24 | 0/24 |
| 1366×768 | 24 | 24/24 | 0/24 |

Na resolução 1366×768, o `main` tem aproximadamente 556 px úteis, enquanto as telas usam alturas mínimas de 800 px (850 px na F5). Portanto, parte dos cards fica abaixo da dobra e exige rolagem. Isso não é corte interno dos cards, mas reduz a leitura simultânea no notebook.

### Resultado do teste de duração

- Simulação: ×300 por 120 s (10 h de processo representadas).
- FPS medido: 60–62.
- Heap: 20–45 MB, oscilação sem tendência de alta contínua neste ensaio.
- Eventos têm limite de 2.000; histórico de tendência é filtrado para 30 minutos; a captura não apontou overflow horizontal ou erro fatal.
- Três conclusões e reinícios foram aceitos. O identificador do lote permaneceu `L-BR100-20261030-01` em todas as iterações do mesmo dia.
- Limite do ensaio: aceleração valida o avanço da lógica, não equivale a 10 h de execução real contínua, teste físico do CLP ou teste prolongado de navegador/estação.

## Problemas encontrados

| ID | Tela/área | Problema e evidência | Severidade | Esforço |
|---|---|---|---|---|
| S01 | F1/F2 — STOP/manual | Após STOP, a sequência aparece como parada/manual, mas M-01 continua ligado e XV-06 (vapor) permanece aberta. A confirmação informa que os equipamentos ficam no estado atual; ainda assim, a semântica de STOP pode ser entendida como parada do processo. A lógica de parada segura precisa definir o destino do vapor, agitador e válvulas, separado da parada de emergência. Evidência: [`1920x1080/manual-liberado/f1-visao-geral.png`](screens/1920x1080/manual-liberado/f1-visao-geral.png). | Alto | G |
| A01 | F1 — alarmes/toasts | Toasts fixos de alarme cobrem a grade de válvulas e sobrepõem a faixa do rodapé em 1920×1080 quando há alarme. O banner de alarmes também cresce com a quantidade de alarmes. Evidência: [`1920x1080/critico/f1-visao-geral.png`](screens/1920x1080/critico/f1-visao-geral.png), [`1920x1080/perda-comunicacao/f1-visao-geral.png`](screens/1920x1080/perda-comunicacao/f1-visao-geral.png). | Alto | M |
| A02 | F1–F6 — 1366×768 | Todas as telas rolam verticalmente na área principal. Isso é alcançável, sem scroll horizontal, mas cartões inferiores não ficam visíveis junto com o cabeçalho e o rodapé. Evidências: [`1366x768/normal/f1-visao-geral.png`](screens/1366x768/normal/f1-visao-geral.png), [`1366x768/normal/f2-sinotico.png`](screens/1366x768/normal/f2-sinotico.png), [`1366x768/normal/f3-tendencias.png`](screens/1366x768/normal/f3-tendencias.png), [`1366x768/normal/f4-alarmes-eventos.png`](screens/1366x768/normal/f4-alarmes-eventos.png), [`1366x768/normal/f5-manutencao.png`](screens/1366x768/normal/f5-manutencao.png), [`1366x768/normal/f6-sobre-projeto.png`](screens/1366x768/normal/f6-sobre-projeto.png). | Médio | M |
| A03 | F3 — tendências | Na etapa de esterilização, a faixa crítica inferior de temperatura cobre quase todo o gráfico (0–117 °C), deixando o painel predominantemente rosa mesmo quando a variável está normal ou em rampa. A cor compete com a curva e sugere uma condição anormal constante. Evidências: [`1920x1080/normal/f3-tendencias.png`](screens/1920x1080/normal/f3-tendencias.png), [`1366x768/normal/f3-tendencias.png`](screens/1366x768/normal/f3-tendencias.png). | Médio | M |
| A04 | F4 — histórico | A coluna Mensagem usa reticências sem expansão visível na linha. Em 1366×768, mensagens de falha/comunicação e reconhecimento perdem o fim; a consulta exige filtro/exportação ou inferência pelas demais colunas. Evidências: [`1920x1080/normal/f4-alarmes-eventos.png`](screens/1920x1080/normal/f4-alarmes-eventos.png), [`1366x768/perda-comunicacao/f4-alarmes-eventos.png`](screens/1366x768/perda-comunicacao/f4-alarmes-eventos.png). | Médio | M |
| A05 | Todas — distância de 2–3 m | Muitos rótulos, metadados, colunas e eventos usam 11–13 px. Os valores primários são grandes, mas nomes, status e textos auxiliares não são legíveis a distância de estande. Evidências: [`1920x1080/normal/f1-visao-geral.png`](screens/1920x1080/normal/f1-visao-geral.png), [`1920x1080/normal/f4-alarmes-eventos.png`](screens/1920x1080/normal/f4-alarmes-eventos.png), [`1920x1080/normal/f5-manutencao.png`](screens/1920x1080/normal/f5-manutencao.png). | Alto | M |
| A06 | F1–F5 — tags | A exibição mistura IDs com underscore (`TIT_100_01`, `XV_100_03`), forma ISA com espaço/hífen (`TIT 100-01`) e tags curtas (`XV-01`, `M-01`). Os mapeamentos existem no config, mas não há uma convenção visual única entre telas. Evidências: [`1920x1080/normal/f1-visao-geral.png`](screens/1920x1080/normal/f1-visao-geral.png), [`1920x1080/normal/f2-sinotico.png`](screens/1920x1080/normal/f2-sinotico.png), [`1920x1080/normal/f4-alarmes-eventos.png`](screens/1920x1080/normal/f4-alarmes-eventos.png). | Médio | M |
| A07 | Lote/registro | Os três reinícios no mesmo dia reutilizaram o mesmo identificador de lote. A função de lote usa sufixo fixo `-01`; isso torna eventos e lotes ambíguos para rastreabilidade. O store e os eventos ficam apenas em memória, sem persistência local/servidor; uma recarga perde o histórico da sessão. Evidências visuais: [`1920x1080/normal/f1-visao-geral.png`](screens/1920x1080/normal/f1-visao-geral.png), [`1920x1080/lote-concluido/f1-visao-geral.png`](screens/1920x1080/lote-concluido/f1-visao-geral.png); confirmação das três iterações em [`results.json`](results.json). | Alto | G |
| A08 | Alarmes — lógica/ISA-18.2 | Há deadband/histerese configurada por variável e timeout de comunicação, mas não há atraso de ativação/normalização configurável, shelving/supressão ou gestão de flood. A avaliação é feita a cada leitura. O ensaio curto não observou chattering, mas não prova desempenho de alarmes em operação diária nem conformidade ISA-18.2. Evidência de estado crítico e reconhecimento: [`1920x1080/critico/f1-visao-geral.png`](screens/1920x1080/critico/f1-visao-geral.png), [`1920x1080/alarme-reconhecido/f4-alarmes-eventos.png`](screens/1920x1080/alarme-reconhecido/f4-alarmes-eventos.png). | Alto | G |
| A09 | Integração de automação | A fonte ativa é o simulador; as telas identificam sensores, CLP, comunicação e ML como simulados. Não há driver OPC UA/MQTT ou fonte de dados real no projeto. É apropriado para demonstração, mas não pode ser usado como supervisório de uma planta real sem integração, validação e segurança de comunicação. Evidência: [`1920x1080/normal/f6-sobre-projeto.png`](screens/1920x1080/normal/f6-sobre-projeto.png). | Alto | G |
| A10 | Operador/auditoria | Todas as ações são atribuídas ao valor fixo `Operador 01`, sem login, identidade individual ou permissões. O registro é útil para demo, mas não oferece responsabilização operacional. Evidências: [`1920x1080/normal/f4-alarmes-eventos.png`](screens/1920x1080/normal/f4-alarmes-eventos.png), [`1920x1080/alarme-reconhecido/f4-alarmes-eventos.png`](screens/1920x1080/alarme-reconhecido/f4-alarmes-eventos.png). | Alto | G |
| A11 | F1/F2 — confirmações | Ao abrir a confirmação de STOP, o console registra warning React: `Function components cannot be given refs`, apontando para `AlertDialogOverlay` e `SlotClone`. Não houve erro fatal nem falha de requisição. Evidência da execução: [`results.json`](results.json); estado de comandos: [`1920x1080/manual-liberado/f1-visao-geral.png`](screens/1920x1080/manual-liberado/f1-visao-geral.png). | Médio | P |
| A12 | Dependências | `npm audit` reporta 9 vulnerabilidades: 1 crítica transitiva (`tar`, dependência de desenvolvimento de `@tailwindcss/oxide`), 6 altas, 1 moderada e 1 baixa. Há também pacotes diretos com correção disponível, incluindo `vite` (6.4.5) e `react-router` (7.18.5); a versão atual do Vite está fixada em 6.3.5. A aplicabilidade ao bundle/servidor de produção deve ser separada antes de atualizar. Evidência: [`npm-audit.json`](npm-audit.json). | Alto | M |
| A13 | Qualidade de código | Não existe script de lint. `tsconfig` não habilita `noUnusedLocals`/`noUnusedParameters`, então `tsc` não cobre código morto. Busca estática indica dependências diretas aparentemente sem referência no código (`@emotion/*`, `@mui/*`, `@popperjs/core`, `canvas-confetti`, `date-fns`, `react-dnd`, `react-dnd-html5-backend`, `react-popper`); confirmar antes de remover. Evidências: [`package.json`](../package.json), [`results.json`](results.json). | Médio | M |
| A14 | Build | Build passa, mas Vite avisa que o chunk JS principal tem 838,98 kB (243,31 kB gzip), acima do limite de 500 kB. Em máquina de estande isso pode aumentar tempo de inicialização e primeira renderização. Evidência: [`build.log`](build.log). | Médio | M |
| A15 | F6/configuração do projeto | Há placeholders a preencher: orientador, nomes dos integrantes, escola, curso e identificação final do projeto/evento. A descrição e cores SENAI também estão marcadas no tema como provisórias. Evidências: [`1920x1080/normal/f6-sobre-projeto.png`](screens/1920x1080/normal/f6-sobre-projeto.png), [`1366x768/normal/f6-sobre-projeto.png`](screens/1366x768/normal/f6-sobre-projeto.png). | Baixo | P |

## Verificações sem problema observado

- **Sem CDN:** as capturas não registraram requisições externas. Fontes IBM Plex e logo são assets locais; bibliotecas são empacotadas pelo Vite.
- **Números:** valores observados usam vírgula decimal e unidade em pt-BR. Pressão do simulador é limitada a valor não negativo no modelo.
- **Coerência de estado:** status geral acompanha alarmes não normalizados e comunicação offline; em estado reconhecido, a prioridade continua ativa até normalizar, e o evento registra `Operador 01`.
- **Processo/intertravamentos:** a ordem de 11 etapas e os bloqueios de motor por nível, bomba por XV-10 e porta por pressão/temperatura têm lógica demonstrativa plausível. Receita, limites e condições seguras ainda precisam de validação de engenharia.
- **Histórico em memória:** há limites explícitos de 2.000 eventos, janela de 30 min para tendências e amostragem limitada da tendência de etapa. No ensaio acelerado não apareceu crescimento de heap sem limite.
- **Build/tipos:** `npm run typecheck` e `npm run build` passaram.

## Top 10 melhorias de maior impacto

1. Definir a parada operacional segura: após STOP, quais saídas (vapor, motor, bomba e válvulas) devem ser fechadas/desligadas, e como diferenciar pausar sequência de parar processo.
2. Impedir que alarm banners/toasts cubram instrumentos, comandos ou rodapé; reservar área para notificações e priorizar apresentação do estado crítico.
3. Implementar identificador único de lote por reinício e persistência do histórico/eventos conforme o tempo de retenção requerido.
4. Fechar o ciclo de alarmes com regras acordadas de prioridade, deadband, atraso, reconhecimento, normalização, supressão e flood; validar com a equipe de automação.
5. Definir fronteira inequívoca entre simulador e CLP real; manter indicação de simulação e criar/testar o adaptador de comunicação antes de qualquer uso operacional.
6. Melhorar leitura a 2–3 m: aumentar tipografia de status, nomes, alarmes e eventos, preservando valores principais e hierarquia ISA-101.
7. Recalibrar as faixas do F3 para não deixar zonas críticas dominarem a área útil do gráfico; rever limites baixos que só são armados após setpoint.
8. Unificar a forma exibida das tags ISA em F1–F5, mantendo alias curto apenas quando houver legenda inequívoca.
9. Definir identidade, autenticação e permissões de operador; manter usuário real nos registros em vez de um nome fixo.
10. Corrigir o warning de refs no AlertDialog, criar lint/análise de dependências e atualizar dependências vulneráveis; reduzir o chunk principal e medir início a frio no estande.

## O que você precisa preencher ou decidir

1. Confirmar os dados de apresentação: nome do orientador, alunos, escola, curso, nome/ano do evento e descrição final do projeto; confirmar logo, cores e manual oficial SENAI.
2. Decidir se o produto do Mundo SENAI é demonstração exclusivamente simulada ou se haverá conexão ao CLP. Se houver, fornecer protocolo, endpoint, tags, credenciais de teste e responsável técnico.
3. Validar com engenharia a receita de 11 etapas: durações, setpoints, limites de alerta/crítico, unidades, sequência de válvulas, permissivos e estado seguro.
4. Escolher uma convenção única de apresentação das tags ISA e decidir se a IHM exibirá também o alias curto do equipamento.
5. Definir política de alarmes ISA-18.2 para este projeto: prioridades, atraso on/off, deadband, reconhecimento, flood, shelving e retenção/exportação.
6. Definir o comportamento seguro para STOP normal, pausa da sequência e parada de emergência (incluindo estado das válvulas e fornecimento de vapor).
7. Definir política de operadores: login ou modo de exposição com usuário genérico explícito, permissões de comando e retenção da trilha de eventos.
8. Confirmar computador e navegador do estande, resolução primária, distância típica de leitura, acesso à internet e se o app deve iniciar localmente em modo kiosk.
9. Aprovar a correção de vulnerabilidades com atualização compatível de Vite/React Router e decidir se dependências aparentemente sem uso devem ser removidas.

## Parecer da Fase 1

A base visual está consistente e as seis telas funcionam no cenário simulado; o ensaio de 10 h aceleradas não revelou degradação de FPS ou heap. Para apresentação, as prioridades imediatas são sobreposição de alarmes, legibilidade, gráfico F3 e conteúdo final. Para qualquer uso industrial real, são bloqueadores a integração validada ao CLP, a rastreabilidade persistente/única dos lotes, a identidade do operador e a política formal de alarmes.

**Aguardando sua aprovação para iniciar a Fase 2.**
