# Deploy

## Arquitetura

- Backend: Oracle VPS, PM2 e filesystem persistente.
- Frontend: Vercel, ainda pendente.
- Codigo: repositorio GitHub privado.

## Vercel

O frontend usa caminhos relativos `/api`. O arquivo `vercel.json` encaminha essas chamadas para a API Oracle.

- URL de producao: `https://bot-console-medieval.vercel.app`.
- Rewrite: `/api/:path*` para a API Oracle na porta `8787`.
- `CORS_ORIGIN`: aplicado com a URL final da Vercel.
- `VITE_API_BASE_URL`: vazio/ausente.

Enquanto o upstream estiver em HTTP, o rewrite serve apenas para validacao de frontend e health. Login e outras operacoes autenticadas exigem HTTPS de ponta a ponta antes da aprovacao final de producao.

## Oracle VPS

Diretorios usados:

```text
/opt/bot-console-medieval/
  current -> releases/<release-id>
  releases/
  shared/
    .env
    logs/
    exports/
    automations/
```

O pacote deve ser criado somente com arquivos versionados:

```bash
git archive --format=tar.gz -o bot-console-medieval-release.tar.gz HEAD
```

Depois de extrair uma nova release:

1. Apontar `.env`, logs, exports e automacoes para `shared`.
2. Executar `npm ci`, `npm run build` e `node --check server.mjs`.
3. Atualizar o symlink `current`.
4. Reiniciar `bot-console-medieval-backend` com `pm2 restart ... --update-env`.
5. Executar `pm2 save`.

## Variaveis De Producao

O arquivo remoto fica em `/opt/bot-console-medieval/shared/.env`, modo `600`.

Variaveis obrigatorias:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID`
- `API_HOST=0.0.0.0`
- `API_PORT=8787`
- `CORS_ORIGIN`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `NODE_ENV=production`

Nunca registrar valores reais em Git, logs ou documentacao.

## PM2

```bash
pm2 status
pm2 logs bot-console-medieval-backend --lines 50 --nostream
pm2 restart bot-console-medieval-backend --update-env
pm2 save
```

O servico de startup e `pm2-ubuntu.service`.

## Health Check

```bash
curl http://127.0.0.1:8787/api/health
```

O health publico esta disponivel na porta `8787`. Rotas autenticadas nao devem ser usadas por HTTP sem TLS.

## HTTPS E CORS

Antes do deploy da Vercel:

1. Configurar HTTPS para a API.
2. Definir `CORS_ORIGIN` como a URL exata do frontend.
3. Reiniciar PM2 com `--update-env`.
4. Confirmar health, login, status e canais pela URL HTTPS.

Nao usar `CORS_ORIGIN=*` em producao.

## Rollback

Use o script versionado:

```bash
./ops/rollback-oracle.sh
./ops/rollback-oracle.sh <release-id>
```

O primeiro comando lista releases. O segundo altera `current`, reinicia o PM2 e salva o estado.
