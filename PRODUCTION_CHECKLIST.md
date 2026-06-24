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
- [x] Firewall Oracle e local configurados para `8787`.
- [x] Rollback documentado.

## Seguranca Pendente

- [ ] Configurar dominio ou proxy HTTPS para a API.
- [x] Trocar `CORS_ORIGIN` pela URL final da Vercel.
- [ ] Revalidar login pela URL HTTPS.
- [ ] Restringir exposicao direta da porta `8787` depois do proxy HTTPS.
- [ ] Revisar advisories npm sem executar correcao automatica.

## Frontend Vercel

- [x] Criar ou vincular projeto Vercel.
- [x] Configurar rewrite relativo `/api`.
- [x] Publicar frontend.
- [x] Validar frontend, assets e health via Vercel.
- [ ] Validar login, canais, mensagens, downloads e automacoes.
- [ ] Validar mobile e desktop em producao.

## Status

**DEPLOY FRONTEND BLOQUEADO PARA USO AUTENTICADO ATE TLS NO BACKEND.**
