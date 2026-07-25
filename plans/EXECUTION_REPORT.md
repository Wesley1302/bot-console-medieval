# Relatório De Execução Dos Planos

Data: 25/07/2026

## Resultado

Os planos 001, 003, 004, 005, 006, 007, 008 e 009 foram executados localmente. O plano 002 teve o hardening local executado, mas a parte de produção ficou bloqueada porque não há domínio/API final nem confirmação para alterar a borda pública.

## Alterações principais

- Baseline de testes server/frontend, lint, sintaxe, build e CI.
- `createApp()` separado do entrypoint e configuração explícita de `TRUST_PROXY`.
- Sessão expirada retorna ao login; `ApiError` preserva status/payload.
- Requests obsoletas são abortadas; polling de mensagens não sobrepõe chamadas.
- Automações usam nonce estável, um tick em voo e reconciliação após pause/cancel/restart.
- Diretório Discord compartilha cache de membros/cargos e usa perfis inline antes de fetch remoto.
- Exportações têm jobs persistidos, fila de cinco pendentes, retomada, checkpoint por conversa, deduplicação linear e limite de bulk de 100 MiB.
- Modal passou a gerenciar Escape, foco, Tab e scroll do body.
- Breakpoint de automações deixou de se sobrepor; e2e de seis viewports passou.
- Código morto comprovado foi removido e menções passaram a ter um único client.
- Roadmap V2 especificado em `docs/v2/`.

## Verificações

- `npm run check`: passou; inclui sintaxe, lint, 33 testes server, 15 testes frontend e build.
- `npx playwright test`: passou com seis viewports e mock de API.
- Nenhum teste usa Discord real ou altera produção.
- Verificação final: `.env` ignorado e não rastreado, `token.md` ausente, varredura de padrões de token/chaves limpa e `git diff --check` sem erros de whitespace.

## Riscos residuais

- Plano 002 ainda requer domínio/API HTTPS e confirmação para configurar Nginx/TLS em produção.
- O limite de bulk de 100 MiB protege JSZip, mas streaming ZIP continua fora do escopo.
- O Gateway/SSE permanece feature V2, portanto a atualização atual continua baseada em polling estabilizado.
- `npm install` reportou advisories; `npm audit fix` não foi executado.
- O working tree contém as alterações desta execução ainda não commitadas; nenhum commit ou deploy foi realizado.
