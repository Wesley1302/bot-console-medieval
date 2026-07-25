# V2.1 Diagnóstico De Permissões

## Problema

Hoje o operador descobre um bloqueio depois da tentativa. A nova tela deve explicar antecipadamente o que o bot pode fazer em cada categoria, canal, fórum e tópico.

## Escopo

- Matriz de leitura, histórico, envio, anexos, edição, exclusão e threads.
- Badges por alvo e filtro por bloqueados.
- Ação somente leitura de testar acesso, sem enviar mensagem.
- Explicação da permissão Discord ausente.

## Fora de escopo

Editar permissões do Discord, sincronizar Gateway ou operar múltiplos servidores.

## Backend e dados

Propor `GET /api/permissions` e `GET /api/permissions/:channelId`. A resposta deve conter alvo, permissões efetivas, origem do bloqueio e `checkedAt`. Overwrites devem considerar guild, membro do bot, cargos e canal; o cálculo precisa ser comparado com um canal QA antes de adoção.

## Segurança e falhas

Rota protegida. Não expor token ou lista sensível de membros. 403/404 devem virar estado parcial com aviso, nunca interromper toda a matriz. Cache curto por canal, guild e versão de snapshot.

## Testes e aceite

- Fixtures com allow, deny, overwrite de cargo e canal privado.
- Resultado consistente em desktop e mobile.
- Nenhuma chamada de escrita.
- Operador identifica por que um envio seria bloqueado sem tentativa real.

**Esforço:** M. **Gate:** construir após validar o cálculo efetivo em QA.
