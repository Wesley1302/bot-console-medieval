# V2.3 Automações Recorrentes

## Problema

A V1 suporta sequência e agendamento único. Mensagens periódicas exigem recriação manual.

## Escopo

Recorrência diária/semanal com timezone explícito, templates, prévia dos chunks de 2.000 caracteres, dry-run de permissões/menções, histórico e janela de silêncio.

## Fora de escopo

Anexos, IA, workflow genérico, cron arbitrário e recorrência sem limite.

## Modelo e idempotência

Separar definição da execução. A ocorrência deve ter `occurrenceId` determinístico, status e nonce por chunk. Restart deve reenfileirar somente ocorrências não confirmadas. DST e alteração da série precisam de testes próprios.

## Aceite

Criar, pausar, retomar, cancelar, simular, executar uma ocorrência e reiniciar o processo sem duplicação. Timezone de Brasília deve ser explícito na UX e no armazenamento.

**Esforço:** G. **Gate:** manter o plano 003 aprovado e definir política de alteração de série.
