# Bot Console Medieval

Painel web para controlar um bot Discord em um servidor especifico. A base atual entrega frontend React/Vite, backend Express, autenticacao por cookie HTTP-only, health check e status real do bot via Discord REST API.

## Ambiente Publicado

- Frontend: `https://bot-console-medieval.vercel.app`.
- Backend: Oracle VPS, acessado pelo rewrite `/api` da Vercel.
- Status: producao validada com TLS, login, status e canais reais.

## Stack

- Node.js
- Express
- dotenv
- cors
- multer
- jszip
- React
- Vite
- lucide-react
- CSS puro
- PostgreSQL
- pgvector
- WebSocket do Discord no worker

## Instalar dependencias

```bash
npm install
```

## Configurar ambiente

Copie `.env.example` para `.env` e preencha os valores necessarios:

```bash
cp .env.example .env
```

Para consultar o status real do bot no Discord, configure:

```env
DISCORD_BOT_TOKEN=token_do_bot
DISCORD_GUILD_ID=id_do_servidor
```

`DISCORD_BOT_TOKEN` nunca e exposto pelo frontend nem retornado em endpoints. `DISCORD_GUILD_ID` e usado por funcoes que dependem de um servidor especifico.

Leia tambem `docs/SECRETS.md` antes de configurar ou trocar credenciais reais.

Para o assistente Gemini e a base textual local, consulte
`docs/GEMINI_KNOWLEDGE.md`. A chave fica somente no `.env`; os arquivos privados
da base permanecem fora do Git.

Para autenticar o operador, configure:

```env
ADMIN_PASSWORD=troque-esta-senha
SESSION_SECRET=gere-um-segredo-longo-aleatorio
```

`ADMIN_PASSWORD` e a senha usada na tela de login. `SESSION_SECRET` assina o token de sessao com HMAC. Use um valor longo e aleatorio.

Em desenvolvimento, o servidor sobe mesmo sem esses valores, mas o login retorna erro claro. Em producao, o servidor falha ao iniciar se eles estiverem ausentes.

## Rodar backend

```bash
npm run dev:server
```

Health check:

```txt
http://127.0.0.1:8787/api/health
```

Status do bot Discord:

```txt
http://127.0.0.1:8787/api/status
```

## Rodar frontend

```bash
npm run dev
```

Frontend:

```txt
http://127.0.0.1:5173
```

## Rodar frontend e backend juntos

```bash
npm run dev:all
```

## Build do frontend

```bash
npm run build
```

## Preview do frontend

```bash
npm run preview
```

## Endpoints existentes nesta etapa

Funcional:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/status` (protegido)
- `GET /api/channels`
- `GET /api/forums/:forumId/threads`
- `GET /api/channels/:channelId/messages`
- `POST /api/messages`
- `PATCH /api/channels/:channelId/messages/:messageId`
- `DELETE /api/channels/:channelId/messages/:messageId`
- `GET /api/exports`
- `POST /api/exports`
- `GET /api/exports/jobs/:jobId`
- `GET /api/exports/:exportId/download`
- `POST /api/exports/bulk-download`
- `DELETE /api/exports/:exportId`
- `GET /api/automations`
- `POST /api/automations`
- `PATCH /api/automations/:automationId`
- `DELETE /api/automations/:automationId`
- `POST /api/cleanup/preview`
- `POST /api/cleanup/jobs`
- `GET /api/cleanup/jobs`
- `GET /api/cleanup/jobs/:jobId`
- `POST /api/cleanup/jobs/:jobId/cancel|pause|resume`
- `POST /api/ai/queries`
- `GET /api/ai/queries`
- `GET /api/ai/queries/:queryId`
- `POST /api/ai/queries/:queryId/cancel`
- `POST /api/knowledge/documents`
- `GET /api/knowledge/documents`
- `GET /api/knowledge/documents/:id`
- `POST /api/knowledge/documents/:id/reprocess`
- `DELETE /api/knowledge/documents/:id`

## Autenticacao

A sessao usa cookie HTTP-only chamado `bcm_session`.

- O frontend nao guarda token em `localStorage`.
- O backend gera um token stateless assinado com HMAC SHA-256.
- O cookie tem duracao de 8 horas.
- Em desenvolvimento, o cookie nao usa `secure`.
- Em producao, o cookie usa `secure`.

Rotas publicas:

- `GET /api/health`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Rotas protegidas:

- `/api/status`
- `/api/channels`
- `/api/forums/:forumId/threads`
- `/api/channels/:channelId/messages`
- `/api/messages`
- `/api/exports`
- `/api/automations`
- `/api/cleanup`
- `/api/ai`
- `/api/knowledge`

## Limpeza E Assistente De IA

Essas capacidades usam PostgreSQL/pgvector e um worker separado. Consulte
`docs/CLEANUP_AI.md` para configurar o banco, executar migracoes, iniciar o
worker, operar a limpeza com confirmacao e usar consultas com evidencias.

Comandos principais:

```bash
npm run db:migrate
npm run knowledge:sync -- --dry-run
npm run knowledge:sync
npm run worker
```

O Discord permanece como fonte oficial das mensagens. Criacoes e edicoes
atualizam o indice; exclusoes removem fisicamente conteudo e embedding.
O conhecimento complementar vem da pasta configurada em
`KNOWLEDGE_SOURCE_PATH`. O upload manual de documentos nao aparece no painel.

Na aba `IA`, o operador pode escolher entre:

- `Analisar`: responde perguntas, resume e organiza fatos e inferencias.
- `Comunicado`: redige um texto administrativo ou tematico em Markdown.
- `Narracao`: transforma cenas e acontecimentos selecionados em narrativa.

Comunicados e narracoes aparecem prontos para copiar, seguidos dos dados e das
evidencias usados. O painel nao publica o texto automaticamente no Discord.

Sem login, rotas protegidas retornam `401`. Com login, canais, foruns/topicos, leitura de mensagens, envio/edicao/exclusao, exportacoes e automacoes ja estao funcionais.

## Discord REST API

Todas as chamadas ao Discord devem passar por `server/src/services/discord.service.mjs`.

O servico central implementa:

- `discordRequest(path, options)`
- `getBotUser()`
- `getGuildInfo()`
- `getDiscordStatus()`
- `assertDiscordConfig()`

Ele usa `https://discord.com/api/v10`, aplica timeout, retry basico para rate limit `429` e erros `5xx`, e retorna erros claros quando `DISCORD_BOT_TOKEN` ou `DISCORD_GUILD_ID` estao ausentes.

## Canais, foruns, topicos e mensagens

Endpoints reais desta etapa:

- `GET /api/channels`
- `GET /api/forums/:forumId/threads`
- `GET /api/channels/:channelId/messages?limit=50`
- `GET /api/channels/:channelId/messages?limit=50&before=:messageId`
- `POST /api/messages`
- `PATCH /api/channels/:channelId/messages/:messageId`
- `DELETE /api/channels/:channelId/messages/:messageId`

Como testar:

1. Configure `.env` com `ADMIN_PASSWORD`, `SESSION_SECRET`, `DISCORD_BOT_TOKEN` e `DISCORD_GUILD_ID`.
2. Rode `npm run dev:all`.
3. Entre no frontend em `http://127.0.0.1:5173`.
4. A sidebar deve listar categorias, canais, foruns e topicos; canais de voz ficam ocultos.
5. Selecione um canal de texto ou anuncio para ler mensagens.
6. Selecione um forum para listar topicos.
7. Selecione um topico para ler mensagens do topico.
8. Use `Carregar mensagens antigas` para testar paginacao com `before`.

Permissoes necessarias do bot nesta etapa:

- View Channels
- Read Message History
- Send Messages
- Attach Files
- Embed Links, opcional mas util
- Send Messages in Threads, para enviar em topicos
- Manage Messages
  - Necessario para apagar mensagens de outros usuarios.
  - Bots so editam suas proprias mensagens.

Observacoes:

- Foruns sao lidos por meio dos topicos.
- Para enviar em forum, abra um topico e envie dentro do topico.
- Canais de voz ficam ocultos na arvore nesta V1.
- Topicos privados arquivados podem depender de permissoes extras. Se o bot nao tiver acesso, a API retorna os topicos publicos/ativos encontrados e inclui um aviso.

## Testar envio, edicao e exclusao

1. Configure `.env` com token/guild validos e permissoes do bot.
2. Faca login no frontend.
3. Selecione um canal de texto ou topico.
4. Envie uma mensagem de texto.
5. Anexe ate 5 arquivos de ate 8 MB cada e envie.
6. Edite uma mensagem enviada pelo bot.
7. Apague uma mensagem. Se for mensagem de outro usuario, o bot precisa de `Manage Messages`.

Validacoes implementadas:

- Conteudo longo e dividido automaticamente em blocos de ate 2000 caracteres, priorizando o ultimo ponto final.
- Envio vazio sem arquivo e recusado.
- Maximo de 5 arquivos.
- Maximo de 8 MB por arquivo.
- Categorias, foruns e canais de voz nao aceitam envio direto.
- Edicao e permitida apenas para mensagens do proprio bot.

## Exportacoes e downloads

Endpoints reais:

- `GET /api/exports`
- `POST /api/exports`
- `GET /api/exports/jobs/:jobId`
- `GET /api/exports/:exportId/download?format=json|md|txt`
- `POST /api/exports/bulk-download`
- `DELETE /api/exports/:exportId`

As exportacoes ficam salvas localmente em `server/exports/`. Cada pacote contem:

- `manifest.json`: metadados, target, totais e nomes dos arquivos.
- `data.json`: dados completos em JSON.
- `export.md`: leitura em Markdown.
- `export.txt`: leitura em texto puro.

Targets suportados:

- Canal de texto e anuncio: exporta o canal e seus topicos ativos.
- Topico/thread: exporta as mensagens do topico.
- Forum: exporta os topicos ativos e arquivados acessiveis.
- Categoria: exporta canais de texto/anuncio, foruns e topicos dentro da categoria.

Downloads:

- Individual: baixe cada pacote em `json`, `md` ou `txt`.
- Em lote combinado: gera um unico arquivo com as exportacoes selecionadas.
- Em lote separado: gera um ZIP com um arquivo por exportacao selecionada.

Observacoes da V1:

- PDF ainda nao foi implementado.
- Anexos nao sao baixados como arquivos locais; o export inclui nome, URL, tipo e tamanho informados pelo Discord.
- Jobs ficam em memoria. Se o backend reiniciar durante uma exportacao, o job em andamento e perdido, mas pacotes ja concluidos permanecem em `server/exports/`.
- Sem token/guild validos, a criacao do job e aceita e o job termina com erro claro ao tentar consultar o Discord.

Como testar exportacoes:

1. Faca login no frontend.
2. Selecione canal, topico, forum ou categoria.
3. Clique em `Exportar`.
4. Aguarde o toast concluir.
5. Abra `Downloads`.
6. Baixe um arquivo individual ou selecione varios pacotes para baixar em lote.

## Automacoes

Automacoes da V1 enviam uma lista de mensagens de texto em sequencia para um canal de texto, anuncio ou topico/thread. Elas sao persistidas localmente em:

```txt
server/automations/
```

Cada automacao usa um arquivo:

```txt
server/automations/<automationId>.json
```

Ao iniciar o backend, arquivos existentes sao carregados. Automacoes com status `running` sao reagendadas; se `nextRunAt` ja passou enquanto o servidor estava desligado, o envio seguinte e agendado imediatamente.

Endpoints:

- `GET /api/automations`
- `POST /api/automations`
- `PATCH /api/automations/:automationId`
- `DELETE /api/automations/:automationId`

Payload de criacao:

```json
{
  "channelId": "123",
  "channelName": "geral",
  "intervalSeconds": 60,
  "messages": [
    "Primeira mensagem",
    "Segunda mensagem"
  ]
}
```

Acoes por `PATCH`:

```json
{ "action": "pause" }
```

Acoes aceitas:

- `pause`: pausa automacao em execucao.
- `resume`: retoma automacao pausada ou com erro.
- `cancel`: cancela automacao ainda nao finalizada.

Estados da automacao:

- `running`: ativa, com proximo envio agendado.
- `paused`: pausada, sem timer ativo.
- `done`: todas as mensagens foram enviadas.
- `cancelled`: cancelada pelo operador.
- `error`: parou por erro e pode ser retomada.

Estados das mensagens:

- `queued`: aguardando envio.
- `sending`: envio em andamento.
- `sent`: enviada com sucesso.
- `error`: falhou no envio.

Validacoes:

- `channelId` obrigatorio.
- Alvo precisa aceitar mensagens: `text`, `announcement` ou `thread`.
- Maximo de 100 mensagens.
- Cada mensagem deve ter texto; conteudo longo e dividido automaticamente no envio.
- `intervalSeconds` minimo de 1 e maximo de 86400.

No frontend:

1. Abra `Automacoes`.
2. No desktop, selecione o alvo na arvore lateral; no mobile, use o seletor.
3. Informe o intervalo.
4. Escreva mensagens separando blocos com uma linha contendo apenas `---`.
5. Use `Mencionar` para inserir usuarios, cargos, `@here` ou `@everyone` na posicao do cursor.
6. Crie a automacao.
7. Use os cards para pausar, retomar, cancelar ou remover.

O seletor de mencoes funciona em sequencias e mensagens agendadas. O bot precisa das permissoes adequadas no Discord para que mencoes de cargos, `@here` ou `@everyone` gerem notificacoes.

Limites da V1:

- Sem anexos em automacoes.
- Agendamento unico por data/hora de Brasilia esta disponivel.
- Sem recorrencia avancada.
- Sem WebSocket.
- Sem banco de dados externo.

Permissoes necessarias:

- View Channels
- Send Messages
- Send Messages in Threads, se o alvo for thread
- Read Message History, util para navegacao e selecao de canais

## Testar login

1. Configure `.env`:

```env
ADMIN_PASSWORD=troque-esta-senha
SESSION_SECRET=gere-um-segredo-longo-aleatorio
```

2. Rode backend e frontend:

```bash
npm run dev:all
```

3. Acesse:

```txt
http://127.0.0.1:5173
```

4. Digite a senha configurada em `ADMIN_PASSWORD`.

5. A sessao permanece em cookie HTTP-only. A rota `POST /api/auth/logout` continua disponivel, embora o painel nao exiba uma acao visual de logout nesta versao.

## Fora da V1 inicial

- WebSocket
- PDF
- Banco de dados externo
- Multi-servidor
- Dominio proprio

## Frontend final medieval

A etapa de acabamento visual da V1 esta documentada em:

- `frontend-research.md`: fontes consultadas, referencias usadas e decisoes descartadas.
- `DESIGN.md`: identidade visual, tokens, componentes, layout, responsividade, motion e acessibilidade.

O frontend usa somente React, Vite, lucide-react e CSS puro. Nao foram adicionadas bibliotecas novas de UI ou animacao.

Telas principais:

- Console: canais, foruns, topicos, mensagens, envio, edicao, exclusao e exportacao.
- Downloads: exportacoes individuais e em lote.
- Automacoes: criacao, pausa, retomada, cancelamento e remocao de sequencias.

## Proximos passos

1. Avaliar exportacao PDF em uma etapa futura.
2. Adicionar retencao/limpeza configuravel para pacotes antigos.
3. Evoluir automacoes com anexos ou agendamento avancado apenas em prompt futuro.
