# Checklist V1

## 1. Configurar `.env`

Crie `bot-console-medieval/.env` a partir de `.env.example` e preencha:

```env
DISCORD_BOT_TOKEN=
DISCORD_GUILD_ID=
API_PORT=8787
API_HOST=127.0.0.1
CORS_ORIGIN=http://127.0.0.1:5173
VITE_API_BASE_URL=
ADMIN_PASSWORD=
SESSION_SECRET=
```

Nunca registre valores reais de token, senha ou segredo em README, logs, prints ou arquivos temporarios.

## 2. Rodar Local

```bash
npm install
npm run dev:all
```

URLs locais:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8787/api/health`

## 3. Testar Login

1. Acesse o frontend.
2. Tente senha incorreta e confirme erro.
3. Entre com `ADMIN_PASSWORD`.
4. Confirme entrada no console.
5. Clique em `Sair`.
6. Confirme retorno para a tela de login.

## 4. Testar Status Do Bot

Backend:

- `GET /api/health` sem login deve retornar `200`.
- `GET /api/status` sem login deve retornar `401`.
- `GET /api/status` autenticado deve retornar bot e servidor.

Se falhar, confira:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- Bot adicionado ao servidor
- Token valido

## 5. Testar Canais

1. Login no frontend.
2. Confirme sidebar com categorias, canais e foruns. Canais de voz ficam ocultos.
3. Canais sem categoria devem aparecer em `SEM CATEGORIA`.
4. Topicos ativos devem aparecer quando aplicavel.

Backend:

- `GET /api/channels`
- `GET /api/forums/:forumId/threads`

## 6. Testar Mensagens

1. Selecione canal de texto.
2. Confirme mensagens em ordem cronologica.
3. Use `Carregar mensagens antigas`.
4. Envie texto.
5. Envie arquivo pequeno.
6. Edite mensagem enviada pelo bot.
7. Apague mensagem, respeitando permissao real do Discord.

Valide erros:

- Mensagem vazia
- Mensagem longa deve ser dividida em blocos de ate 2000 caracteres.
- Arquivo maior que 8 MB
- Mais de 5 arquivos
- Envio direto para forum, categoria ou voz

## 7. Testar Exportacoes

1. Selecione canal, forum, topico ou categoria.
2. Clique em `Exportar`.
3. Aguarde o toast terminar.
4. Abra `Downloads`.
5. Baixe `json`, `md` e `txt`.
6. Selecione multiplas exportacoes e teste lote `combined`.
7. Teste lote `separate` para ZIP.
8. Exclua uma exportacao e confirme que some da lista.

Arquivos esperados:

- `server/exports/<exportId>/manifest.json`
- `server/exports/<exportId>/data.json`
- `server/exports/<exportId>/export.md`
- `server/exports/<exportId>/export.txt`

## 8. Testar Automacoes

1. Abra `Automacoes`.
2. No desktop, selecione canal ou topico na arvore lateral; no mobile, use o seletor.
3. Defina intervalo.
4. Separe mensagens com uma linha contendo apenas `---`.
5. Crie automacao.
6. Verifique status `running`.
7. Aguarde mensagens aparecerem no Discord.
8. Teste `Pausar`.
9. Teste `Retomar`.
10. Teste `Cancelar`.
11. Teste `Remover`.
12. Teste tambem o modo agendado com data/hora futura de Brasilia.
13. Para restart: crie automacao com intervalo alto, reinicie backend e confirme reagendamento.

Arquivos ficam em:

- `server/automations/<automationId>.json`

## 9. Permissoes Do Bot No Discord

Minimas para navegacao e leitura:

- View Channels
- Read Message History

Para envio:

- Send Messages
- Attach Files
- Send Messages in Threads, se usar topicos

Para exclusao:

- Manage Messages, se precisar apagar mensagens de outros usuarios

Para foruns/topicos:

- View Channels
- Read Message History
- Acesso ao forum/topico

## 10. Erros Comuns E Solucao

- `DISCORD_BOT_TOKEN nao configurado.`: preencha a variavel no `.env`.
- `DISCORD_GUILD_ID nao configurado.`: preencha o ID do servidor.
- `Token Discord invalido ou expirado.`: gere ou revise o token do bot.
- `Bot sem permissao`: ajuste permissoes no servidor/canal.
- `Recurso Discord nao encontrado.`: confira IDs e se o bot esta no servidor.
- `Arquivo excede o limite de 8 MB.`: reduza o arquivo.
- `Envie no maximo 5 arquivos por mensagem.`: reduza anexos.
- Mensagens longas sao divididas automaticamente; confirme a ordem dos blocos no Discord.
- `Exportacao nao encontrada.`: confira se a pasta ainda existe.
- `Automacao nao encontrada.`: confira se o arquivo local nao foi removido.

## 11. O Que Ainda Nao Existe Na V1

- PDF
- WebSocket
- Banco de dados externo
- Multi-servidor
- OAuth
- Usuarios multiplos
- Permissoes complexas no painel
- Anexos em automacoes
- Recorrencia avancada
- IA dentro do bot
- Deploy final

## 12. Criterios Para V1 Pronta

- Build passa.
- Backend sobe.
- Frontend sobe.
- Login/logout funcionam.
- Status real do bot funciona.
- Canais e mensagens carregam.
- Envio, upload, edicao e exclusao funcionam conforme permissao.
- Exportacoes geram arquivos e downloads.
- Automacoes enviam sequencia e sobrevivem a restart.
- Erros sao compreensiveis.
- Nenhum segredo e exposto.

## 13. Resultado Da Rodada Prompt 09

Data: 2026-06-19.

Resultado:

- Build passou.
- Sintaxe do backend passou.
- Checks em `server/src/**/*.mjs` passaram.
- Testes reais com Discord nao foram executados porque `bot-console-medieval/.env` nao existe.
- Foi criado `ENV_REQUIRED.md` com as variaveis necessarias.
- A V1 ainda nao pode ser considerada release candidate aprovada.

Antes de deploy, execute novamente os testes reais com:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Critério final: somente marcar a V1 como pronta quando status real do bot, canais, mensagens, envio, upload, exportacoes, downloads e automacoes forem testados contra Discord real.

## 14. Resultado Da Rodada Prompt 09B

Data: 2026-06-19.

Configuracao:

- `.env` local criado.
- `DISCORD_BOT_TOKEN`: presente.
- `DISCORD_GUILD_ID`: presente.
- `ADMIN_PASSWORD`: presente.
- `SESSION_SECRET`: presente.
- `token.md`: removido apos migracao para `.env`.

Testes reais aprovados:

- Backend e frontend subiram localmente.
- `GET /api/health`: aprovado.
- Login real via `.env`: aprovado.
- `/api/status`: retornou bot e servidor reais.
- `/api/channels`: retornou categorias, canais, voz, forum e threads reais.
- Leitura de mensagens e paginacao `before`: aprovadas.
- Listagem de topicos de forum real: aprovada.
- Envio de mensagem real: aprovado.
- Erros de mensagem vazia, acima de 2000 caracteres, voz e forum direto: aprovados.
- Upload pequeno: aprovado.
- Upload acima de 8 MB: erro amigavel aprovado.
- Edicao de mensagem do bot: aprovada.
- Bloqueio de edicao de mensagem que nao e do bot: aprovado.
- Exclusao de mensagens enviadas pelo bot: aprovada.
- Exportacao de canal: aprovada.
- Arquivos `manifest.json`, `data.json`, `export.md`, `export.txt`: aprovados.
- Downloads `json`, `md`, `txt`: aprovados.
- Formato invalido `pdf`: erro amigavel aprovado.
- Bulk download `combined`: aprovado.
- Bulk download `separate`: aprovado.
- Exportacao de forum: aprovada.
- Automacao real com 3 mensagens: aprovada.
- Pause, resume, cancel e delete de automacao: aprovados apos correcao.

Testes nao concluidos ou nao executados:

- Exportacao de categoria iniciou, mas nao concluiu dentro da janela do teste por volume alto de mensagens.
- Restart de automacao nao foi executado nesta rodada.
- Fluxo visual completo no navegador e responsivo em 390px, 430px, 768px e desktop nao foi automatizado por falta de ferramenta local de browser.

Bug corrigido:

- Corrida de gravacao em `saveAutomation` quando timer e acao do operador salvavam a mesma automacao ao mesmo tempo.

Antes de deploy:

- Executar uma checagem manual do frontend em desktop/mobile.
- Repetir exportacao de categoria em uma categoria menor ou com janela de teste maior.
- Testar restart de automacao com backend real.

## 15. Resultado Do QA Final E Bug Bash

Data: 2026-06-20.

- Build e sintaxe: aprovados.
- Smoke HTTP autenticado: aprovado.
- Restart de automacao: aprovado.
- Exportacao de categoria: concluida.
- Desktop/mobile: aprovados em seis dimensoes.
- Forum, topico, canal vazio, Downloads e Automacoes: aprovados.
- Logout mobile: aprovado.
- Console e network: sem erros apos correcoes.
- Artefatos `[QA LOCAL]`: removidos.
- Segredos reais fora do `.env`: nao encontrados no projeto.

Status final: **PRONTO PARA DEPLOY**, com smoke test pos-deploy.
