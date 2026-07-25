# Decision Log V2

| Data | Decisão | Consequência | Reavaliar quando |
|---|---|---|---|
| 25/07/2026 | Preservar filesystem e single-guild na V1 | Menor risco e migração reversível | Houver demanda por multi-servidor ou multi-instância |
| 25/07/2026 | Priorizar diagnóstico de permissões | Reduz falhas de operação antes de novas automações | Cálculo efetivo não puder ser validado em QA |
| 25/07/2026 | Manter polling como fallback até spike de Gateway/SSE | Evita dependência de nova conexão em produção | Eventos e reconexão tiverem desenho aprovado |
| 25/07/2026 | Não implementar as seis features neste ciclo | Roadmap fica revisável e cada feature ganha plano próprio | Operador aprovar um escopo específico |
