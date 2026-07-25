# V2.6 Workspaces Multi-servidor

## Gate obrigatório

Só construir se houver demanda real por pelo menos dois servidores. A V1 permanece single-guild até esse gate.

## Problema

Um segundo servidor exige isolamento de configuração, arquivos, permissões, jobs e rate limits.

## Decisões necessárias

Autenticação e RBAC, banco/migração, onboarding seguro do guild, isolamento de paths, confirmação reforçada para ações destrutivas e limites agregados.

## Fora de escopo

Marketplace, OAuth amplo e seleção sem autorização explícita.

## Aceite

Dois workspaces não podem compartilhar sessão, exportação, automação ou dados de diretório. Testar troca, revogação, restart e migração sem acesso cruzado.

**Esforço:** XL. **Gate:** demanda confirmada e modelo de acesso aprovado.
