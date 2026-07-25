# V2.4 Caixa De Eventos Em Tempo Real

## Problema

O polling de cinco segundos atualiza consulta, mas não oferece evento imediato nem caixa consolidada de menções, edições e exclusões.

## Arquitetura a investigar

Processo Discord Gateway dedicado com intents mínimos, reconexão, sequence/resume e estado visível de desatualização. SSE servidor-browser é a primeira opção se o fluxo continuar unidirecional; polling segue como fallback.

## Segurança e operação

Não expor eventos brutos fora do guild autorizado. Limitar volume, aplicar backpressure e impedir que uma reconexão duplique evento. Persistir offset somente se houver estratégia clara de replay.

## Spike e aceite

Medir eventos/minuto em QA, comparar SSE/WebSocket, testar reconnect/resume, perda de conexão e fallback. Só implementar após decidir processo único versus multi-instância.

**Esforço:** G/XL. **Gate:** intents e estratégia de recuperação aprovados.
