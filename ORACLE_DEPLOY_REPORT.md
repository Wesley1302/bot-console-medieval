# Oracle Deploy Report

## Data/Hora

2026-06-23 22:59:51 -03:00.

## Objetivo

Publicar o backend do Bot Console Medieval em uma Oracle VPS, com release versionada, dados persistentes e gerenciamento por PM2.

## Referencia

- Commit implantado: `2e31245`.
- Tag de referencia: `v1-ready-for-deploy`.
- Repositorio: `Wesley1302/bot-console-medieval` (privado).
- VPS: `164.152.xxx.xxx`.
- Usuario SSH: `ubuntu`.
- Chave local: `C:\Users\wesle\.ssh\oracle-bot-console\ssh-key-2026-06-11.key`.
- Sistema: Ubuntu 24.04.4 LTS ARM64.

## Checks Locais

- Working tree limpa antes do deploy.
- Nenhum ambiente, token ou chave rastreado pelo Git.
- `npm run build`: aprovado.
- `node --check`: 22 arquivos ESM aprovados.
- Pacote criado com `git archive`: 107 entradas e zero entradas proibidas.
- SHA-256 do pacote validado antes da extracao remota.

## Preparacao Da VPS

- Pacotes do Ubuntu atualizados.
- Limpeza segura de pacotes e cache executada.
- Reinicializacao requerida e concluida com autorizacao do usuario.
- Dependencias base instaladas: certificados, curl, GnuPG, Git e build tools.
- Node.js `20.20.2`, npm `10.8.2` e PM2 `7.0.1` instalados.

## Release E Persistencia

- Raiz: `/opt/bot-console-medieval`.
- Release: `/opt/bot-console-medieval/releases/20260621024512`.
- Atual: `/opt/bot-console-medieval/current`.
- Ambiente persistente: `/opt/bot-console-medieval/shared/.env`, modo `600`.
- Logs: `/opt/bot-console-medieval/shared/logs`.
- Exportacoes: `/opt/bot-console-medieval/shared/exports`.
- Automacoes: `/opt/bot-console-medieval/shared/automations`.
- O arquivo temporario de ambiente foi removido da maquina local e da VPS.

## Validacao Remota

- `npm ci`: aprovado.
- Build Vite: aprovado.
- `node --check`: 22 arquivos ESM aprovados.
- `dist/index.html`: presente.
- PM2 `bot-console-medieval-backend`: online, sem restarts inesperados.
- Startup systemd `pm2-ubuntu`: habilitado.
- Health local `127.0.0.1:8787`: `200`.
- Health publico: `200`.
- `/api/status` publico sem sessao: `401`.
- Login interno na VPS: `200`.
- Cookie HTTP-only: confirmado.
- `/api/auth/me` interno: autenticado.
- `/api/status` interno: bot e guild presentes.
- `/api/channels` interno: arvore real presente.

## Rede E Firewall

- NSG Oracle permite TCP `22` e `8787`.
- Firewall local permite TCP `8787` antes da regra final de rejeicao.
- Persistencia instalada com `iptables-persistent` e `netfilter-persistent` habilitado.
- SSH permaneceu acessivel durante a configuracao.

## Seguranca E Pendencias

- Nenhum segredo foi impresso ou versionado.
- Login publico nao foi executado por HTTP sem TLS.
- `CORS_ORIGIN` permanece temporariamente em `http://127.0.0.1:5173`.
- Antes de conectar o frontend, configurar HTTPS e trocar `CORS_ORIGIN` pela URL final da Vercel.
- O npm reportou tres advisories em ferramentas de desenvolvimento (`esbuild` e `concurrently`/`shell-quote`). Nenhum `npm audit fix` foi executado.

## Erros E Correcoes

- A porta `22` estava bloqueada no NSG; regra criada pelo painel Oracle.
- A porta `8787` estava bloqueada no NSG e no firewall local; ambas as regras foram adicionadas.
- Scripts PowerShell/Bash tiveram conflitos de aspas e CRLF; os passos afetados foram isolados, repetidos e validados.
- O diretorio local foi renomeado de `BOT - COROA` para `BOT - CDV`; o deploy continuou no caminho correto.

## Status

**BACKEND ORACLE DEPLOYADO. FRONTEND E HTTPS PENDENTES.**

## Proximos Passos

1. Configurar dominio ou proxy HTTPS para a API.
2. Atualizar `CORS_ORIGIN` na VPS.
3. Reiniciar o PM2 com `--update-env`.
4. Publicar o frontend na Vercel e executar smoke test ponta a ponta.
