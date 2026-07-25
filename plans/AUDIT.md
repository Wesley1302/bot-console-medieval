# Auditoria de refatoração e evolução V2

## Escopo e método

- Repositório: `D:\CODEX\BOT - CDV\bot-console-medieval`
- Referência: branch `main`, commit `06a1660`
- Data: 24/07/2026
- Escopo analisado: 65 arquivos JS/JSX/MJS/CSS, aproximadamente 6 mil linhas,
  documentação de produto, QA, deploy e histórico Git.
- Restrições respeitadas: nenhuma alteração de código, nenhum build, nenhum
  deploy, nenhuma leitura de `.env` e nenhuma chamada real ao Discord.
- Verificação executada: `node --check` em `server.mjs` e em todos os `.mjs` de
  `server/src`; todos passaram.

As evidências abaixo descrevem o estado atual. Limitações declaradas da V1 não
foram tratadas automaticamente como bugs.

## Resumo executivo

O projeto tem uma arquitetura compreensível e adequada ao tamanho atual:
frontend React, rotas Express finas e serviços concentrando integração com
Discord e filesystem. A refatoração não deve começar por uma reescrita ou por
novas abstrações genéricas.

O maior obstáculo para versionar com segurança é a ausência de uma verificação
automatizada versionada. Os scripts de QA existentes vivem em `.tmp/`, não fazem
parte do Git e não protegem refatorações futuras. Depois dessa baseline, as
prioridades são:

1. eliminar risco de credenciais trafegando em HTTP;
2. corrigir duplicação possível em automações pausadas durante envio;
3. estabilizar o ciclo assíncrono do frontend;
4. reduzir chamadas N+1 ao Discord;
5. limitar memória, tempo e estado dos jobs de exportação;
6. consolidar a cascata CSS e seus breakpoints.

## Achados priorizados

### [TEST-01] Crie uma verificação automatizada versionada antes de refatorar

- **Evidência**: `package.json:6-12` contém somente dev, build, preview e start;
  não há scripts de teste, lint ou check.
- **Evidência**: não existe arquivo versionado com nome `*.test.*` ou `*.spec.*`;
  os smoke tests estão em `.tmp/`, pasta ignorada pelo Git.
- **Impacto**: qualquer extração de serviço, mudança de estado ou consolidação
  CSS pode quebrar login, mensagens, exportações ou automações sem feedback
  determinístico.
- **Esforço**: M.
- **Risco da correção**: BAIXO; os primeiros testes são de caracterização.
- **Confiança**: ALTA.
- **Correção resumida**: adicionar testes de domínio/API, lint, check único e CI,
  sem tentar alcançar cobertura percentual artificial.

### [SEC-01] Termine TLS antes de considerar o fluxo autenticado seguro

- **Evidência**: `vercel.json:5` reescreve `/api` para uma origem Oracle em
  `http://...:8787`.
- **Evidência**: `DEPLOY.md:12-17` e `VERCEL_DEPLOY_REPORT.md:71-78` registram
  que login e operações autenticadas continuam pendentes por falta de HTTPS no
  upstream.
- **Impacto**: senha administrativa e cookie podem atravessar o trecho
  Vercel→Oracle sem criptografia. O frontend HTTPS não elimina esse trecho.
- **Esforço**: M, com pré-requisito de domínio DNS.
- **Risco da correção**: MÉDIO; envolve Nginx/TLS, firewall, rewrite e rollback.
- **Confiança**: ALTA.
- **Correção resumida**: publicar a API em domínio HTTPS, apontar o rewrite para
  HTTPS e fechar a porta 8787 para acesso público.

### [SEC-02] Restrinja proxy confiável e CORS de produção

- **Evidência**: `server.mjs:19` usa `trust proxy = true` em produção.
- **Evidência**: `server/src/routes/auth.routes.mjs:21-23` usa `req.ip` como
  chave do rate limit.
- **Evidência**: `server/src/middleware/cors.mjs:26` aceita `*` mesmo com
  `credentials: true` em `server/src/middleware/cors.mjs:34`.
- **Impacto**: com a API pública, headers de proxy podem tornar o rate limit por
  IP menos confiável; uma configuração acidental `CORS_ORIGIN=*` abre origens
  credenciadas.
- **Esforço**: S–M.
- **Risco da correção**: MÉDIO; configuração errada pode bloquear login.
- **Confiança**: ALTA para o padrão de código, MÉDIA para exploração real.
- **Correção resumida**: configurar hops/proxies explicitamente, testar a cadeia
  Vercel/Nginx e recusar wildcard em produção.

### [BUG-01] Torne o envio de automações idempotente

- **Evidência**: `server/src/services/automations.service.mjs:259-261` persiste a
  mensagem como `sending` antes da chamada remota.
- **Evidência**: `server/src/services/automations.service.mjs:270-273` retorna
  sem registrar o sucesso se a automação foi pausada/cancelada durante o envio.
- **Evidência**: `server/src/services/automations.service.mjs:324-328` converte
  `sending` novamente em `queued` ao retomar.
- **Impacto**: o Discord pode receber a mensagem, mas o arquivo local não
  registra o sucesso; ao retomar, a mesma mensagem pode ser enviada novamente.
  Reinício no estado `sending` tem risco semelhante.
- **Esforço**: M.
- **Risco da correção**: MÉDIO; altera uma máquina de estados crítica.
- **Confiança**: ALTA.
- **Correção resumida**: usar nonce persistido por chunk com `enforce_nonce`,
  serializar ticks por automação e sempre reconciliar o resultado remoto antes
  de respeitar o novo estado pause/cancel.

### [BUG-02] Impeça respostas antigas de sobrescrever o canal atual

- **Evidência**: `src/components/messages/MessagePanel.jsx:54-75` carrega
  mensagens sem cancelamento ou generation token.
- **Evidência**: `src/components/messages/MessagePanel.jsx:100-139` faz polling
  e recria o intervalo sempre que `messages` ou `refreshStatus` muda.
- **Evidência**: `src/components/forums/ForumThreadList.jsx:47-63` repete o
  padrão sem guarda de resposta obsoleta.
- **Impacto**: ao trocar rapidamente de canal/fórum, uma resposta lenta anterior
  pode aparecer na seleção nova; o polling sofre churn e pode concluir depois
  que a tela já mudou.
- **Esforço**: M.
- **Risco da correção**: MÉDIO; scroll, paginação e atualização em tempo real
  precisam continuar iguais.
- **Confiança**: ALTA.
- **Correção resumida**: centralizar ciclo de request com `AbortController` ou
  request generation, usar callback estável e um intervalo independente da
  lista de mensagens.

### [BUG-03] Centralize expiração de sessão

- **Evidência**: `src/App.jsx:11-27` só verifica a sessão no bootstrap.
- **Evidência**: `src/api/client.js:19-22` descarta status/metadata e lança apenas
  `Error(message)`.
- **Impacto**: após 8 horas ou reinício de segredo, a interface continua no
  console e cada painel mostra erros isolados, em vez de voltar ao login.
- **Esforço**: S–M.
- **Risco da correção**: BAIXO.
- **Confiança**: ALTA.
- **Correção resumida**: criar erro de API com `status`, emitir um único evento
  de sessão expirada em 401 e fazer `App` voltar ao estado anônimo.

### [BUG-04] Faça “horário de Brasília” ser realmente independente do navegador

- **Evidência**: `src/components/automations/AutomationForm.jsx:44-52` gera e
  interpreta `datetime-local` no timezone do navegador.
- **Evidência**: `src/components/automations/AutomationForm.jsx:149` envia o
  resultado de `toISOString()`, apesar do rótulo em
  `src/components/automations/AutomationForm.jsx:237` dizer Brasília.
- **Evidência**: `server/src/services/automations.service.mjs:60-65` aceita o
  instante sem validar a zona de origem.
- **Impacto**: operador fora de `America/Sao_Paulo` agenda para um horário
  diferente do exibido.
- **Esforço**: M.
- **Risco da correção**: MÉDIO; automações já persistidas devem manter o instante
  UTC existente.
- **Confiança**: ALTA.
- **Correção resumida**: definir contrato explícito para `America/Sao_Paulo`,
  converter apenas novas entradas e testar fusos distintos.

### [PERF-01] Elimine N+1 de membros e chamadas duplicadas de cargos

- **Evidência**: `server/src/services/messages.service.mjs:62-76` executa uma
  request por autor e menção únicos de cada página.
- **Evidência**: `server/src/services/messages.service.mjs:101-119` já recebe
  `message.member`, mas o carregamento faz fetch dos usuários antes de aproveitar
  os dados embutidos.
- **Evidência**: `server/src/services/channels.service.mjs:184-207` busca cargos
  novamente a cada consulta de menção; o composer consulta após 120 ms em
  `src/components/messages/Composer.jsx:65-88`.
- **Impacto**: abrir um canal com muitos participantes pode gerar dezenas de
  requests, aumentar latência e consumir rate limit do Discord.
- **Esforço**: M.
- **Risco da correção**: MÉDIO; nomes e avatares do servidor não podem regredir
  para identidades globais.
- **Confiança**: ALTA.
- **Correção resumida**: criar um diretório/cache compartilhado de guild,
  aproveitar `message.member`, buscar apenas lacunas e limitar concorrência.

### [PERF-02] Reestruture exportações grandes para tempo e memória limitados

- **Evidência**: `server/src/services/exports.service.mjs:152-165` usa
  `messages.some` dentro de cada página, produzindo deduplicação O(n²).
- **Evidência**: `server/src/services/exports.service.mjs:171-196` mantém todas
  as conversas e mensagens em memória, e `server/src/services/exports.service.mjs:285-290`
  serializa JSON, Markdown e TXT juntos.
- **Evidência**: `server/src/services/exports.service.mjs:11,90-98` mantém jobs
  apenas em um `Map`, sem persistência, expiração ou limite de concorrência.
- **Impacto**: categorias grandes podem consumir memória excessiva; restart
  perde o job; o mapa cresce durante toda a vida do processo.
- **Esforço**: L.
- **Risco da correção**: ALTO; formatos e downloads existentes precisam ser
  byte/semanticamente compatíveis.
- **Confiança**: ALTA.
- **Correção resumida**: usar `Set` para IDs, fila com concorrência limitada,
  metadata persistente/expirada e escrita incremental por conversa.

### [RESP-01] Corrija o breakpoint contraditório de automações

- **Evidência**: `src/styles/medieval-theme.css:1313-1317` define uma coluna até
  980px.
- **Evidência**: `src/styles/medieval-theme.css:1319-1339`, declarado depois,
  volta a duas colunas a partir de 901px.
- **Impacto**: entre 901px e 980px o formulário e a lista ficam lado a lado,
  contrariando a regra anterior e comprimindo os controles.
- **Esforço**: S.
- **Risco da correção**: BAIXO.
- **Confiança**: ALTA.
- **Correção resumida**: escolher um único breakpoint e adicionar regressão
  visual em 900, 901, 980 e 981px.

### [TECH-01] Reduza a cascata CSS duplicada antes de ampliar a UI

- **Evidência**: `src/styles/medieval-theme.css` tem mais de 1.500 linhas e
  redefine `.message-list` em `:323` e `:1000`, `.composer` em `:400` e `:1123`,
  e os mesmos painéis em múltiplas camadas.
- **Evidência**: `src/styles/global.css:5-16` usa `overflow-x: hidden` em `html`
  e `body`, o que pode mascarar a origem de overflow.
- **Impacto**: correções dependem da ordem do arquivo, breakpoints entram em
  conflito e uma mudança mobile pode alterar desktop sem intenção.
- **Esforço**: M.
- **Risco da correção**: ALTO sem screenshots baseline; MÉDIO após o plano 001.
- **Confiança**: ALTA.
- **Correção resumida**: consolidar por componente sem mudar tokens ou aparência,
  removendo a regra antiga somente depois de comparação visual.

### [ARCH-01] Defina uma única propriedade para dados de canais

- **Evidência**: `src/components/channels/ChannelTree.jsx:93-110` busca a árvore.
- **Evidência**: `src/components/automations/AutomationForm.jsx:85-104` busca a
  mesma árvore novamente.
- **Evidência**: `src/api/channels.api.js:11-15` e
  `src/api/mentions.api.js:3-7` duplicam o mesmo endpoint de menções.
- **Impacto**: dados podem divergir entre sidebar e formulário, requests são
  repetidas e novas views tendem a criar uma terceira fonte.
- **Esforço**: M.
- **Risco da correção**: MÉDIO; a regra desktop/mobile de seleção de alvo deve
  permanecer.
- **Confiança**: ALTA.
- **Correção resumida**: mover a árvore para um hook controlado pelo `AppShell`,
  passar dados à sidebar/formulário e manter uma API canônica por recurso.

### [A11Y-01] Complete o comportamento de teclado do modal

- **Evidência**: `src/components/ui/Modal.jsx:4-19` define `role="dialog"`, mas
  não move/restaura foco, não fecha com Escape e não contém o foco.
- **Impacto**: usuários de teclado podem interagir com conteúdo atrás do modal
  ou perder o ponto de navegação.
- **Esforço**: S–M.
- **Risco da correção**: BAIXO.
- **Confiança**: ALTA.
- **Correção resumida**: foco inicial, Escape, focus trap mínimo e retorno ao
  elemento acionador, cobertos por teste.

### [DEBT-01] Remova superfícies mortas somente depois da baseline

- **Evidência**: `src/components/dashboard/DashboardHome.jsx` não é importado por
  nenhum módulo ativo.
- **Evidência**: `src/styles/layout.css:191-245` e regras responsivas associadas
  mantêm CSS do dashboard removido.
- **Evidência**: `src/components/channels/ChannelContextMenu.jsx` é um placeholder
  não usado; menus reais são implementados localmente em outros componentes.
- **Impacto**: executores futuros podem editar ou reativar por engano caminhos
  que não fazem parte do produto.
- **Esforço**: S.
- **Risco da correção**: BAIXO após testes; desnecessariamente alto antes deles.
- **Confiança**: ALTA.
- **Correção resumida**: provar ausência de imports, remover código/CSS órfão e
  consolidar APIs duplicadas sem “faxina” lateral.

## Avaliação da arquitetura atual

### O que deve ser preservado

- `discord.service.mjs` como única borda HTTP com o Discord.
- Rotas Express finas usando serviços e `next(error)`.
- Sessão stateless em cookie HTTP-only e `/api/auth/me` não lançando 401.
- Componentes de UI simples e CSS puro, sem framework novo.
- Persistência local enquanto houver apenas uma instância e um servidor.
- Contratos atuais de respostas, inclusive `message` + `messages` no envio
  fragmentado e `results` no endpoint de menções.

### Limites que precisam ficar explícitos

```text
HTTP/Express routes
  -> application services
    -> Discord adapter / filesystem repositories

React view
  -> resource hooks
    -> api client
```

Não é necessário criar “clean architecture” completa. O objetivo é permitir
mockar as bordas remotas e persistentes, preservar regras puras em módulos
testáveis e impedir que cada componente invente seu próprio polling/cache.

## Funcionalidades recomendadas para a V2

### 1. Central de permissões e diagnóstico do bot

**Nova capacidade**: selecionar categoria/canal/tópico e ver uma matriz
“pode visualizar / ler histórico / enviar / anexar / gerenciar mensagens /
enviar em threads”, com botão de reteste e orientação exata.

**Por que faz sentido**: hoje permissões só aparecem como erro depois da ação
(`discord.service.mjs:90-97`, `messages.service.mjs:203-208`). A interface já
possui a árvore completa e o status do bot.

**Valor**: reduz configuração por tentativa e erro e transforma o painel em
ferramenta operacional, não apenas cliente de mensagens.

**Esforço aproximado**: M. Requer endpoint de permission overwrite efetiva e
cache curto; não requer banco.

### 2. Diário de auditoria operacional

**Nova capacidade**: registrar envios, edições, exclusões, exportações e ações
de automação em uma timeline pesquisável, com alvo, horário, resultado e motivo.

**Por que faz sentido**: o painel já executa ações destrutivas e automáticas,
mas os únicos rastros são arquivos de automação/exportação e logs genéricos.

**Valor**: responsabilidade operacional, diagnóstico de “quem/o que apagou ou
enviou” e evidência para manutenção.

**Esforço aproximado**: M–L. Pode começar com JSONL append-only e rotação; banco
só se torna necessário em multioperador/multi-instância.

### 3. Automações recorrentes, templates e simulação

**Nova capacidade**: recorrência semanal/mensal em Brasília, templates
reutilizáveis, preview dos chunks/menções e modo dry-run que não envia.

**Por que faz sentido**: a V1 já tem sequência e um agendamento único
(`AutomationForm.jsx:201-269`), mas não cobre tarefas recorrentes nem permite
validar o resultado antes do disparo.

**Valor**: reduz trabalho manual repetitivo e erros em mensagens longas.

**Esforço aproximado**: L. Deve vir após idempotência e timezone do plano 003.

### 4. Inbox de eventos e menções em tempo real

**Nova capacidade**: feed de mensagens que mencionam o bot/cargos selecionados,
edições/exclusões e eventos de threads, com filtros e contador não lido.

**Por que faz sentido**: a V1 usa polling a cada 5 segundos
(`MessagePanel.jsx:132-139`) e a detecção de menções em eventos foi adiada por
exigir Gateway. A estrutura atual já normaliza mensagens e menções.

**Valor**: o operador acompanha o servidor sem abrir canal por canal e reage
rapidamente.

**Esforço aproximado**: L. Requer Discord Gateway no backend e SSE/WebSocket
entre backend e frontend; deve ter fallback para REST.

### 5. Exportação avançada e reexecutável

**Nova capacidade**: filtrar por período, autor, tipo de conteúdo e presença de
anexos; salvar uma “receita de exportação”; gerar pacote com índice e anexos
opcionais.

**Por que faz sentido**: a V1 exporta tudo do alvo e já produz três formatos,
mas grandes categorias custam tempo/memória e não há filtros.

**Valor**: downloads menores, investigações específicas e backups repetíveis.

**Esforço aproximado**: L. Depende do pipeline limitado do plano 006.

### 6. Workspaces multi-servidor

**Nova capacidade**: cadastrar múltiplos servidores autorizados, alternar
workspace e aplicar permissões/automação/exportação no guild selecionado.

**Por que faz sentido**: quase todos os serviços já recebem IDs, mas
`DISCORD_GUILD_ID` é global (`env.mjs:6`) e a interface assume um único servidor.

**Valor**: transforma o painel de instalação única em ferramenta reutilizável
para mais comunidades.

**Esforço aproximado**: XL. Exige modelo de configuração segura, isolamento de
dados e provavelmente persistência estruturada. Recomendada somente depois das
cinco anteriores ou quando houver demanda real.

## Ordem recomendada para a V2

1. Base técnica dos planos 001–008.
2. Central de permissões, por ser barata e reduzir suporte.
3. Diário de auditoria, antes de ampliar automações.
4. Automações recorrentes/templates.
5. Inbox em tempo real com Gateway.
6. Exportação avançada.
7. Multi-servidor somente com demanda comprovada.

## Riscos de uma refatoração apressada

- Extrair serviços antes de testes pode alterar silenciosamente nomes/avatares
  do servidor, ordem das mensagens e formato dos downloads.
- “Resolver” automações só com mais flags locais não elimina duplicação após
  crash; é necessária idempotência na borda Discord.
- Instalar uma store global não corrige requests obsoletas.
- Dividir CSS por arquivo sem consolidar seletores apenas muda a localização da
  cascata conflitante.
- Introduzir banco antes de definir contratos de repositório acopla regras ao
  fornecedor e amplia o escopo sem necessidade atual.
