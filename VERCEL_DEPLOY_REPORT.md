# Vercel Deploy Report

## Data/Hora

2026-06-23, America/Sao_Paulo.

## Objetivo

Publicar o frontend Vite na Vercel e encaminhar `/api/*` para o backend Oracle.

## Referencia

- Commit inicial: `82f6698`.
- Commit da configuracao Vercel: `2ed2e9d`.
- Backend alvo: Oracle VPS `164.152.xxx.xxx`, porta `8787`.
- Estrategia: rewrite Vercel `/api/:path*` para Oracle `/api/:path*`.
- Client frontend: API relativa, `credentials: include`.
- `VITE_API_BASE_URL`: vazio/ausente em producao.

## Checks Iniciais

- Working tree limpa antes da configuracao.
- Zero arquivos sensiveis rastreados.
- `npm run build`: aprovado.
- `node --check`: 22 arquivos ESM aprovados.
- Vercel CLI `50.28.0` executada via `npx`.
- Autenticacao Vercel: aprovada.

## Status Do Deploy

Frontend publicado em producao na Vercel. Rewrite e health aprovados. Validacao autenticada bloqueada ate o backend ter TLS.

## URL Final

`https://bot-console-medieval.vercel.app`

## CORS

`CORS_ORIGIN` atualizado na Oracle para `https://bot-console-medieval.vercel.app`. PM2 reiniciado e health local permaneceu `200`.

## Testes Executados

- Frontend publico `/`: `200`.
- Titulo do aplicativo presente no HTML.
- Dois assets JS/CSS: `200`, zero falhas.
- Rewrite `/api/health`: `200`.
- Rewrite `/api/status` sem sessao: `401`.
- PM2: online apos restart, PID confirmado.
- Health local Oracle: `200`.
- CORS final: confirmado sem exibir o `.env`.

## Testes Nao Executados

- Login pela Vercel: nao executado para nao transmitir a senha pelo upstream HTTP.
- Status, canais, mensagens, downloads e automacoes autenticados: dependem do login seguro.
- Escrita `[PROD QA]`, exportacao e automacao: puladas para evitar credenciais em transporte sem TLS e spam.
- Responsivo visual 390px, 430px, 768px e desktop: navegador automatizado indisponivel nesta sessao.

## Bugs Encontrados E Corrigidos

- A CLI adicionou `.vercel` duplicado ao `.gitignore`; duplicacao removida.
- A primeira atualizacao remota de CORS falhou por interpretacao de aspas PowerShell/Bash; repetida com script temporario, validada e removida.
- O primeiro deploy de um projeto novo foi publicado diretamente como producao pela Vercel; alias final confirmado.

## Dados PROD QA

Nenhuma mensagem, exportacao ou automacao de QA foi criada. Nao houve dados para limpar.

## Restricao De Seguranca

O trecho navegador-Vercel usa HTTPS, mas o rewrite ainda acessa a Oracle por HTTP publico. Nenhuma senha administrativa sera enviada nesse fluxo ate existir TLS no backend. O deploy pode validar frontend e health, mas nao sera marcado como producao autenticada validada sem transporte HTTPS de ponta a ponta.

## Proximos Passos

1. Configurar dominio e TLS para o backend Oracle.
2. Alterar o rewrite para o endpoint HTTPS.
3. Revalidar login, cookie, status, canais e mensagens pela Vercel.
4. Executar QA responsivo e escrita minima controlada.

## Status Final

**DEPLOY FRONTEND BLOQUEADO PARA USO AUTENTICADO.**

O frontend esta publicado e o health funciona, mas producao nao pode ser marcada como validada enquanto credenciais atravessariam o trecho Vercel-Oracle por HTTP.

## Patch 12 - Preparacao Em 2026-06-24

- Projeto Vercel alvo confirmado localmente: `bot-console-medieval`.
- URL principal a preservar: `https://bot-console-medieval.vercel.app`.
- Build e validacao local do patch aprovados.
- Deploy do patch: concluido no mesmo `projectId`.
- Deployment: `https://bot-console-medieval-g7gt2e0fy-wesleys-projects-1e089870.vercel.app`.
- Alias principal preservado: `https://bot-console-medieval.vercel.app`.
- Root, JS, CSS e `/api/health`: 200.
- `/api/status` sem sessao: 401.
- Bundle publicado contem `Mencionar` e nao contem `COROA DE VIDRO`.
- A restricao de seguranca do upstream HTTP permanece; nenhum login sera transmitido pela Vercel durante a validacao.

## Validacao Final TLS - 25/07/2026

- Commit de configuracao: `d4d4731`.
- Deployment: `dpl_BeVDch1GzEvoHo2N2F6RF3E9uvEY`.
- Alias final: `https://bot-console-medieval.vercel.app`.
- Rewrite atualizado para `https://164.152.50.184/api/:path*`.
- Root, favicon, JavaScript, CSS e `/api/health`: `200`.
- `/api/status` sem sessao: `401`.
- Login: `200`.
- Cookie: `HttpOnly`, `Secure` e `SameSite=Lax`.
- `/api/auth/me`: autenticado.
- `/api/status`: bot e guild reais presentes.
- `/api/channels`: 21 categorias e 320 topicos ativos na rodada.
- Origem Vercel permitida pelo CORS; origem hostil recusada.

**Status final: PRODUCAO VALIDADA.**
