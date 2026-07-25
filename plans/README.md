# Planos de implementação

Gerados em 24/07/2026 a partir do commit `06a1660`, após auditoria somente
leitura com as skills `improve` e `ponytail`.

Estes planos existem para serem executados por um modelo sem contexto prévio.
O executor deve ler o plano inteiro, respeitar o escopo e interromper o trabalho
quando encontrar uma condição de parada. Nenhum plano autoriza deploy ou alteração
de produção sem confirmação explícita do operador.

## Ordem e status

| Plano | Título | Prioridade | Esforço | Depende de | Status |
|---|---|---:|---:|---|---|
| 001 | Criar baseline automatizada de segurança | P1 | M | — | DONE |
| 002 | Fechar o transporte e a borda HTTP de produção | P0 | M | 001 | DONE |
| 003 | Tornar automações idempotentes e livres de corrida | P0 | M | 001 | DONE |
| 004 | Estabilizar sessão, polling e ciclo de requests do frontend | P1 | M | 001 | DONE |
| 005 | Unificar diretório do Discord e eliminar N+1 de perfis | P1 | M | 001 | DONE |
| 006 | Tornar exportações limitadas, persistentes e eficientes | P1 | L | 001, 005 | DONE |
| 007 | Consolidar CSS responsivo e acessibilidade operacional | P1 | M | 001, 004 | DONE |
| 008 | Remover código morto e consolidar limites dos módulos | P2 | M | 003–007 | DONE |
| 009 | Preparar o roadmap funcional da V2 | P2 | M | 001–008 | DONE |

Status permitidos: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED: motivo` e
`REJECTED: motivo`.

## Dependências

- O plano 001 vem primeiro porque toda refatoração precisa de testes de
  caracterização que preservem os contratos da V1.
- Os planos 002 e 003 corrigem os riscos mais graves e podem ser executados em
  paralelo depois do plano 001.
- O plano 006 depende do cache/diretório do plano 005 para não transformar
  exportações longas em centenas de chamadas desnecessárias ao Discord.
- O plano 007 deve usar os estados assíncronos estabilizados no plano 004 antes
  de criar regressões visuais automatizadas.
- O plano 008 é propositalmente posterior: remover duplicação e código morto
  antes de estabilizar os fluxos só aumentaria o risco.
- O plano 009 é um plano de design/spike. Ele não autoriza construir todas as
  features simultaneamente.

## Regras globais para os executores

1. Nunca ler, imprimir, copiar ou versionar valores de `.env`.
2. Nunca alterar contratos de API sem teste de compatibilidade e aprovação.
3. Não adicionar banco, framework de estado ou biblioteca de UI por conveniência.
4. Fazer mudanças incrementais: adicionar o caminho novo, migrar chamadas,
   verificar e só então remover o caminho antigo.
5. Não executar deploy, push ou ações reais no Discord sem confirmação.
6. Ao concluir um plano, executar todos os comandos da seção “Critérios de
   conclusão” e atualizar apenas a linha correspondente nesta tabela.

## Achados considerados e não priorizados

- **Migrar para TypeScript agora**: rejeitado. A migração tocaria quase todo o
  repositório antes de existir uma suíte de testes e não corrige os riscos mais
  graves. Reavaliar depois dos planos 001–008.
- **Adicionar Redux/Zustand**: rejeitado. O estado compartilhado atual cabe em
  hooks e propriedades de `AppShell`; uma store global seria complexidade
  prematura.
- **Trocar CSS puro por Tailwind/shadcn**: rejeitado. Contraria `design.md`,
  causaria grande churn visual e não resolve a causa da cascata duplicada.
- **Trocar filesystem por banco imediatamente**: rejeitado para a refatoração.
  Primeiro introduzir contratos de repositório e persistência atômica. Um banco
  pode ser escolhido na V2 se multi-instância ou multi-servidor exigir.
- **Otimizações cosméticas de bundle**: baixa prioridade. O bundle tem poucas
  dependências; concorrência, rede e exportação dominam o risco atual.

## Artefatos

- `plans/AUDIT.md`: diagnóstico completo, evidências e direção de produto.
- `plans/001-*.md` a `plans/009-*.md`: handoffs executáveis.
