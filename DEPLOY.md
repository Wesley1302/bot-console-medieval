# Deploy

## Arquitetura

- Backend: Oracle VPS, PM2 e filesystem persistente.
- Frontend: Vercel, publicado e validado.
- Codigo: repositorio GitHub privado.

## Vercel

O frontend usa caminhos relativos `/api`. O arquivo `vercel.json` encaminha essas chamadas para a API Oracle.

- URL de producao: `https://bot-console-medieval.vercel.app`.
- Rewrite: `/api/:path*` para `https://164.152.50.184/api/:path*`.
- `CORS_ORIGIN`: aplicado com a URL final da Vercel.
- `VITE_API_BASE_URL`: vazio/ausente.

O navegador e o upstream Vercel-Oracle usam HTTPS. Login, status e canais foram
validados pelo alias de producao.

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
- `API_HOST=127.0.0.1`
- `API_PORT=8787`
- `CORS_ORIGIN`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `NODE_ENV=production`
- `TRUST_PROXY=loopback`

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

O health publico fica disponivel somente pelo Nginx:

```bash
curl https://164.152.50.184/api/health
curl https://bot-console-medieval.vercel.app/api/health
```

A porta `8787` escuta apenas em loopback e nao e publica.

## HTTPS E CORS

- Nginx encerra TLS nas portas `80/443` e encaminha `/api/` para
  `127.0.0.1:8787`.
- O certificado Let’s Encrypt usa o IP publico como identificador e tem
  renovacao automatica pelo timer do Certbot.
- O hook de renovacao recarrega o Nginx.
- `CORS_ORIGIN` corresponde exatamente a
  `https://bot-console-medieval.vercel.app`.
- Wildcard de CORS e recusado em producao.

Monitoramento recomendado:

```bash
sudo certbot certificates
systemctl status snap.certbot.renew.timer
sudo certbot renew --dry-run
sudo nginx -t
```

## Rollback

Use o script versionado:

```bash
./ops/rollback-oracle.sh
./ops/rollback-oracle.sh <release-id>
```

O primeiro comando lista releases. O segundo altera `current`, reinicia o PM2 e salva o estado.
