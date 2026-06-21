# ENV_REQUIRED

## Status

Resolvido em 2026-06-19.

`bot-console-medieval/.env` foi criado localmente e as variaveis obrigatorias estao presentes. Os valores reais nao sao exibidos neste documento.

## Arquivo Necessario

Crie:

```txt
bot-console-medieval/.env
```

Com as variaveis abaixo:

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

## Variaveis Obrigatorias Para Teste Real

- `DISCORD_BOT_TOKEN`: presente.
- `DISCORD_GUILD_ID`: presente.
- `ADMIN_PASSWORD`: presente.
- `SESSION_SECRET`: presente.

## Variaveis De Execucao Local

- `API_PORT`: presente.
- `API_HOST`: presente.
- `CORS_ORIGIN`: presente.
- `VITE_API_BASE_URL`: pode ficar vazio para usar o proxy/local relativo.

## Como Reexecutar O Prompt 09

1. Garantir que `bot-console-medieval/.env` continua presente.
2. Garantir que o bot esta no servidor informado por `DISCORD_GUILD_ID`.
3. Garantir permissoes no canal de teste:
   - View Channels
   - Read Message History
   - Send Messages
   - Attach Files
   - Send Messages in Threads, se testar topicos
   - Manage Messages, se testar apagar mensagens de outros usuarios
4. Rodar novamente a bateria do Prompt 09.

## Regras De Seguranca

- Nao commitar `.env`.
- Nao copiar `DISCORD_BOT_TOKEN` para README, relatorios, prints ou logs.
- Nao criar arquivos como `token.md`.
- Nao expor `ADMIN_PASSWORD` ou `SESSION_SECRET`.
