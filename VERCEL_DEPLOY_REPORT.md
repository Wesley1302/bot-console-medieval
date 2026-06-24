# Vercel Deploy Report

## Data/Hora

2026-06-23, America/Sao_Paulo.

## Objetivo

Publicar o frontend Vite na Vercel e encaminhar `/api/*` para o backend Oracle.

## Referencia

- Commit inicial: `82f6698`.
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

Configuracao preparada; deploy pendente.

## URL Final

Pendente.

## CORS

Pendente de URL final da Vercel.

## Restricao De Seguranca

O trecho navegador-Vercel usa HTTPS, mas o rewrite ainda acessa a Oracle por HTTP publico. Nenhuma senha administrativa sera enviada nesse fluxo ate existir TLS no backend. O deploy pode validar frontend e health, mas nao sera marcado como producao autenticada validada sem transporte HTTPS de ponta a ponta.

## Proximos Passos

1. Publicar a configuracao no GitHub.
2. Criar e publicar o projeto Vercel.
3. Registrar a URL final.
4. Atualizar `CORS_ORIGIN` na Oracle.
5. Validar health e frontend publico.
