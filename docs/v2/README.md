# Roadmap V2

Este diretório transforma a auditoria da V1 em especificações executáveis. A V2 deve preservar a V1 como baseline, avançar uma capacidade por vez e exigir um plano de implementação, testes e rollback antes de qualquer código.

## Ordem recomendada

1. Diagnóstico de permissões por canal.
2. Trilha de auditoria operacional.
3. Automações recorrentes, templates e simulação.
4. Caixa de eventos em tempo real.
5. Exportações avançadas e reexecutáveis.
6. Workspaces multi-servidor, somente com demanda real.

## Regras de entrada

- Não adicionar banco, Gateway ou multi-servidor por antecipação.
- Não registrar conteúdo de mensagens, tokens, cookies ou senhas.
- Toda escrita deve manter idempotência, limites e confirmação operacional.
- Cada feature precisa de um gate explícito em `decision-log.md`.
