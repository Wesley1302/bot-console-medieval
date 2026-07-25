# Plano 002: Fechar o transporte e a borda HTTP de produção

> **Instruções ao executor**: este plano tem uma parte local reversível e uma
> parte de produção irreversível. Não altere DNS, Oracle, firewall, Vercel ou
> PM2 sem confirmação explícita do operador. Nunca imprima `.env`, cookies,
> senha ou token.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- vercel.json server.mjs server/src/config/env.mjs server/src/middleware/cors.mjs ops DEPLOY.md .env.example`

## Status

- **Prioridade**: P0
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: `plans/001-criar-baseline-automatizada.md`
- **Categoria**: segurança
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

O frontend é HTTPS, mas o rewrite envia `/api` para a Oracle por HTTP público.
Esse trecho pode transportar senha e cookie sem TLS. A aplicação também confia
em qualquer proxy em produção e aceita wildcard de CORS se configurado. A V2
não deve ser construída sobre uma borda autenticada ainda insegura.

## Estado atual

```json
// vercel.json:2-6
{
  "rewrites": [{
    "source": "/api/:path*",
    "destination": "http://<oracle-ip>:8787/api/:path*"
  }]
}
```

```js
// server.mjs:19
app.set('trust proxy', env.IS_PRODUCTION);
```

```js
// cors.mjs:25-27
|| (!env.IS_PRODUCTION && isLocalProjectOrigin(origin))
|| allowedOrigins.includes('*')
|| allowedOrigins.includes(origin)
```

`DEPLOY.md` confirma que login público está bloqueado até TLS.

## Pré-requisitos externos

Antes da fase de produção, o operador deve fornecer:

- domínio/subdomínio da API, por exemplo `api.exemplo.com`;
- acesso ao DNS;
- confirmação para SSH/Oracle/Vercel;
- caminho da chave SSH fora do repositório.

Sem esses itens, concluir somente a configuração/testes locais e marcar o plano
`BLOCKED: aguardando domínio e confirmação de produção`.

## Comandos necessários

| Objetivo | Comando | Esperado |
|---|---|---|
| Gate local | `npm run check` | exit 0 |
| Sintaxe Nginx remota | `sudo nginx -t` | successful |
| Health interno | `curl -fsS http://127.0.0.1:8787/api/health` | JSON `ok:true` |
| Health TLS | `curl -fsS https://<api-domain>/api/health` | JSON `ok:true` |
| Vercel | `curl -fsS https://bot-console-medieval.vercel.app/api/health` | JSON `ok:true` |

## Escopo

**Local**:

- `server.mjs` ou `server/src/app.mjs` criado no plano 001
- `server/src/config/env.mjs`
- `server/src/middleware/cors.mjs`
- `.env.example`
- `vercel.json`
- `ops/nginx-bot-console.conf` (criar template)
- `tests/server/security-config.test.mjs`
- `DEPLOY.md`
- `PRODUCTION_CHECKLIST.md`
- `plans/README.md`

**Remoto, somente com confirmação**:

- DNS do domínio da API;
- `/etc/nginx/sites-available/bot-console-medieval`;
- certificado TLS;
- `/opt/bot-console-medieval/shared/.env`;
- UFW/NSG Oracle;
- PM2.

**Fora de escopo**:

- trocar autenticação;
- mudar cookie para localStorage;
- expor porta diferente;
- criar novo projeto Vercel;
- alterar token/senha/secret.

## Passos

### Passo 1: tornar proxy confiável configurável e verificável

1. Adicionar `TRUST_PROXY` ao `.env.example`, vazio em desenvolvimento.
2. Em produção, não usar booleano `true` por padrão.
3. Interpretar valores permitidos explicitamente:
   - `loopback`;
   - número inteiro de hops;
   - lista CIDR validada.
4. Falhar startup em produção para valor inválido.
5. O valor final deve refletir a topologia real
   `Vercel -> Nginx -> Express`; não adivinhar.
6. Adicionar testes com chains `X-Forwarded-For` mostrando qual `req.ip` resulta.

**Verificar**: testes de configuração passam e desenvolvimento continua usando
IP do socket/local.

### Passo 2: recusar CORS wildcard com credenciais em produção

1. Em `env.mjs`, se produção e `CORS_ORIGIN` contém `*`, lançar erro claro sem
   imprimir demais variáveis.
2. Remover o ramo `allowedOrigins.includes('*')` em produção.
3. Preservar:
   - requests sem `Origin` (curl/server-to-server);
   - origem exata da Vercel;
   - localhost somente fora de produção.
4. Testar origem permitida, negada e sem Origin.

**Verificar**: `npm run test:server` passa; wildcard em produção falha no
startup de teste.

### Passo 3: preparar Nginx/TLS versionável

Criar `ops/nginx-bot-console.conf` como template sem IP/segredo:

- `listen 80` apenas para challenge/redirect;
- `listen 443 ssl http2`;
- `server_name <API_DOMAIN>`;
- proxy `/api/` para `http://127.0.0.1:8787`;
- headers `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`;
- timeout suficiente para downloads, sem ilimitado;
- limite de body compatível com upload atual;
- headers básicos `X-Content-Type-Options`, `Referrer-Policy` e frame policy.

Documentar placeholders; não gravar domínio inventado.

**Verificar**: revisão estática confirma que upstream é loopback e não contém
segredo.

### Passo 4: configurar domínio e TLS na Oracle

**Exige confirmação do operador.**

1. Criar registro DNS para o IP Oracle.
2. Instalar/configurar Nginx e Certbot conforme Ubuntu atual.
3. Aplicar template com domínio real.
4. Emitir certificado.
5. Executar `sudo nginx -t` antes de reload.
6. Confirmar health via HTTPS.
7. Não fechar 8787 ainda.

**Verificar**: `curl -fsS https://<api-domain>/api/health` retorna 200.

### Passo 5: trocar Vercel para upstream HTTPS

1. Alterar somente `destination` do `vercel.json` para
   `https://<api-domain>/api/:path*`.
2. Fazer preview deployment primeiro.
3. Validar health, login, `/api/status` e `/api/channels`.
4. Promover o mesmo projeto/alias somente após os quatro passarem.

**Verificar**: chamadas autenticadas funcionam pelo domínio Vercel; cookie não é
impresso.

### Passo 6: fechar a porta pública

Depois da validação:

1. manter Express em `127.0.0.1:8787` ou bloquear 8787 em UFW/NSG;
2. preservar portas 22, 80 e 443;
3. testar que `http://<oracle-ip>:8787/api/health` deixa de ser público;
4. testar que Nginx local e Vercel continuam funcionando;
5. salvar PM2.

**Verificar**:

- acesso público direto a 8787 falha;
- HTTPS da API e Vercel retornam 200;
- PM2 online.

### Passo 7: atualizar documentação

Atualizar `DEPLOY.md` e checklist com:

- domínio da API (não segredo);
- topologia final;
- configuração real de `TRUST_PROXY`;
- rollback;
- data e resultados sem cookies/senha.

## Plano de testes

- CORS: origem Vercel, origem hostil, sem Origin e localhost dev.
- Proxy: chains de 0, 1 e 2 hops conforme topologia final.
- Auth: login, `me`, status e logout via Vercel.
- Download e upload pequenos após TLS.
- Rollback Nginx/Vercel documentado e testado em preview.

## Critérios de conclusão

- [ ] `npm run check` passa.
- [ ] Rewrite Vercel usa HTTPS.
- [ ] API HTTPS retorna 200.
- [ ] 8787 não está pública.
- [ ] Login/status/canais funcionam pela Vercel.
- [ ] CORS wildcard é impossível em produção.
- [ ] `trust proxy` representa a topologia validada.
- [ ] Nenhum segredo entrou no Git ou relatório.
- [ ] Plano 002 marcado `DONE`.

## Condições de parada

- Não há domínio controlado pelo operador.
- Certificado não pode ser emitido.
- `nginx -t` falha.
- Fechar 8787 interrompe o rewrite.
- O executor precisa imprimir `.env` para continuar.
- A mudança apontaria para um projeto Vercel diferente.

## Manutenção

- Renovação do certificado deve ser monitorada.
- Se a topologia de proxy mudar, revalidar `req.ip` e rate limit.
- Não aceitar novamente upstream HTTP como “temporário” em produção autenticada.
