# Relatório De Execução Dos Planos

Data: 25/07/2026

## Resultado

Os planos 001 a 009 foram executados. O plano 002 foi concluido em producao
usando certificado Let’s Encrypt para o IP da Oracle, sem exigir dominio
proprio.

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
- A suite automatizada nao altera o Discord; o smoke autenticado de producao
  confirmou bot, guild e canais reais sem criar mensagens.
- Verificação final: `.env` ignorado e não rastreado, `token.md` ausente, varredura de padrões de token/chaves limpa e `git diff --check` sem erros de whitespace.

## Riscos residuais

- O certificado IP e de curta duracao; renovacao automatica e monitoramento sao
  obrigatorios.
- O limite de bulk de 100 MiB protege JSZip, mas streaming ZIP continua fora do escopo.
- O Gateway/SSE permanece feature V2, portanto a atualização atual continua baseada em polling estabilizado.
- `npm install` reportou advisories; `npm audit fix` não foi executado.
- As alteracoes foram commitadas, enviadas ao GitHub e publicadas na Oracle e
  na Vercel.
