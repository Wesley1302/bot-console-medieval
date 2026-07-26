# Production Checklist

## Backend Oracle

- [x] Ubuntu atualizado e reiniciado.
- [x] Node.js 20 instalado.
- [x] PM2 instalado e habilitado no boot.
- [x] Release versionada em `/opt/bot-console-medieval/releases`.
- [x] `.env` remoto com modo `600`.
- [x] Logs, exports e automacoes persistentes.
- [x] `npm ci`, build e checks de sintaxe aprovados.
- [x] Health local `200`.
- [x] Health publico `200`.
- [x] Rotas sem sessao protegidas com `401`.
- [x] Login, status e canais validados internamente na VPS.
- [x] Firewall Oracle e local configurados para `22`, `80` e `443`.
- [x] Rollback documentado.

## Seguranca

- [x] Configurar Nginx e certificado TLS valido para o IP da API.
- [x] Trocar `CORS_ORIGIN` pela URL final da Vercel.
- [x] Revalidar login pela URL HTTPS.
- [x] Restringir a porta `8787` a loopback.
- [x] Validar renovacao automatica do certificado com dry-run.
- [ ] Revisar advisories npm sem executar correcao automatica.

## Frontend Vercel

- [x] Criar ou vincular projeto Vercel.
- [x] Configurar rewrite relativo `/api`.
- [x] Publicar frontend.
- [x] Validar frontend, assets e health via Vercel.
- [x] Validar login, status e canais pelo alias de producao.
- [x] Validar root, JS, CSS e favicon em producao.
- [ ] Repetir escrita, downloads e automacoes em producao (nao bloqueante; ja aprovados com Discord real antes do deploy).
- [ ] Repetir QA visual mobile e desktop em producao (nao bloqueante; seis viewports aprovados localmente).

## Status

**PRODUCAO VALIDADA PARA OS FLUXOS PRINCIPAIS.**

## Limpeza E IA

- [x] Provisionar PostgreSQL com pgvector.
- [x] Configurar variaveis de banco sem expor segredos.
- [x] Executar `npm run db:migrate`.
- [x] Criar armazenamento persistente `shared/knowledge`.
- [x] Subir `bot-console-medieval-worker` no PM2.
- [x] Validar inicializacao do Gateway e reconciliacao.
- [x] Publicar e validar as novas rotas e o frontend pelo alias Vercel.
- [x] Configurar credencial e cadeia de fallback Gemini sem expor segredo.
- [x] Sincronizar a base local privada: 21 documentos e 47 chunks prontos.
- [x] Validar embeddings `gemini-embedding-2` com 768 dimensoes.
- [x] Validar consulta generativa real com evidencias da base privada.
- [ ] Configurar backup automatizado e testar restauracao do PostgreSQL.
- [ ] Validar limpeza em canal exclusivo de QA com confirmacao e rollback operacional.

**Infraestrutura, jobs persistentes, base local e IA generativa estao ativos e
validados em producao.**
