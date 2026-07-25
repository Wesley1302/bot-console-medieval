# Plano 005: Unificar diretório do Discord e eliminar N+1 de perfis

> **Instruções ao executor**: o objetivo é reduzir requests sem perder nickname,
> avatar animado ou nome configurado no servidor. Testes usam fixtures; não
> consulte Discord real até o operador autorizar um smoke final.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- server/src/services/messages.service.mjs server/src/services/channels.service.mjs server/src/services/discord.service.mjs src/api src/components/mentions src/components/messages`

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: `plans/001-criar-baseline-automatizada.md`
- **Categoria**: performance / arquitetura
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

Uma página de mensagens executa uma request por usuário/menção únicos mesmo
quando o payload já contém `member`. Cargos são buscados por dois serviços com
caches diferentes, e a pesquisa de menções pode consultar cargos a cada tecla.
Isso aumenta latência e rate limit exatamente nos canais mais ativos.

## Estado atual

```js
// messages.service.mjs:74-76
await Promise.all([...userIds].map(async (userId) => {
  profiles.set(userId, await getGuildMemberProfile(userId));
}));
```

```js
// messages.service.mjs:103-104
const serverName = memberProfile?.nick || message.member?.nick || null;
const serverAvatar = memberProfile?.avatar || message.member?.avatar || null;
```

Apesar do fallback acima, `loadMemberProfiles` já fez fetch de todos os autores.

`channels.service.mjs:184-207` busca members e roles para menções; outro cache de
roles existe em `messages.service.mjs:81-91`.

## Comandos

| Objetivo | Comando | Esperado |
|---|---|---|
| Teste focado | `npm run test:server -- --test-name-pattern="guild directory|message profile|mention"` | todos passam |
| Gate | `npm run check` | exit 0 |

## Escopo

**Pode modificar/criar**:

- `server/src/services/guild-directory.service.mjs` (criar)
- `server/src/services/messages.service.mjs`
- `server/src/services/channels.service.mjs`
- `tests/server/guild-directory.service.test.mjs`
- `tests/server/messages.service.test.mjs`
- `tests/server/channels.service.test.mjs`
- `plans/README.md`

**Não modificar**:

- shape público de `author`, `mentions`, `roleMentions`;
- `/api/mentions`;
- ordem das mensagens;
- frontend/CSS;
- intents/permissões do bot;
- TTL por variável de ambiente sem necessidade.

## Design mínimo

Criar um serviço específico, não um cache genérico:

```js
createGuildDirectory({ discordRequest, guildId, clock })
  .getMember(id)
  .getMembers(ids, inlineProfiles)
  .getRoles()
  .searchMembers(query, limit)
  .invalidate()
```

Singleton de produção exportado junto à factory para testes.

Política inicial:

- membro positivo: 5 min;
- membro 403/404: 60 s;
- roles: 5 min;
- Promise em voo compartilhada por chave;
- no máximo 5 fetches individuais simultâneos.

Esses valores devem ser constantes nomeadas e testadas, não magic numbers
espalhados.

## Passos

### Passo 1: mapear perfil inline antes de qualquer request

Criar helper puro que extrai:

- autor: `message.author.id` + `message.member.nick/avatar`;
- menções: `mention.id` + `mention.member.nick/avatar`.

Para cada ID, preferir dado inline da mesma mensagem. Somente IDs sem nickname/
avatar necessários devem ir ao diretório remoto.

Observação: `nick: null` pode ser dado válido. Diferenciar “campo conhecido e
nulo” de “perfil não carregado”.

**Verificar**: fixture com 20 mensagens e 4 autores contendo `member` gera zero
fetch individual.

### Passo 2: implementar cache e coalescência

1. Map por member ID com `expiresAt`, `profile` e opcional `promise`.
2. Requests simultâneas do mesmo ID aguardam a mesma Promise.
3. 403/404 vira cache negativo curto.
4. 429/5xx não vira cache negativo.
5. Roles usam uma única Promise/cache compartilhada.
6. `invalidate()` serve a futuros refreshes/admin; não criar endpoint agora.

**Verificar**:

- duas chamadas simultâneas fazem uma request;
- clock após TTL faz nova request;
- erro transitório não fica preso;
- 404 respeita TTL negativo.

### Passo 3: limitar concorrência sem dependência nova

Implementar helper local pequeno para processar IDs em lotes de 5. Não instalar
biblioteca de queue.

Preservar ordem do Map final.

**Verificar**: fake adapter registra pico máximo de 5 requests.

### Passo 4: migrar normalização de mensagens

Substituir `memberProfileCache`, `roleProfileCache`, `getGuildMemberProfile`,
`loadMemberProfiles` e `loadRoleProfiles` pelo diretório.

Manter `normalizeMessage` puro e compatível. Se necessário, passar Maps prontos
como hoje.

Cobrir prioridade:

1. nickname/avatar do servidor;
2. global name/avatar global;
3. username;
4. fallback “Usuario”.

GIF de avatar do servidor deve continuar usando extensão correta.

**Verificar**: snapshots estruturais dos objetos normalizados antes/depois são
iguais para fixtures da V1.

### Passo 5: migrar pesquisa de menções

Em `searchMentionTargets`:

- member search continua usando endpoint de search quando há termo;
- consulta vazia mantém limite 25;
- roles vêm do cache compartilhado;
- filtrar `@everyone` role como hoje;
- manter `users`, `roles`, `special`, `results`, `warnings`;
- não transformar falha de members em falha total.

**Verificar**: digitar cinco variações de query dentro do TTL faz no máximo uma
request de roles.

### Passo 6: documentar métricas operacionais sem logar PII

Adicionar somente logs agregados em debug/desenvolvimento se já existir nível
adequado; caso contrário, não ampliar logger neste plano.

Métricas úteis para teste:

- IDs atendidos inline;
- cache hit/miss;
- requests remotas.

Não logar nomes, conteúdo de mensagens ou tokens.

## Critérios de conclusão

- [ ] Dados inline evitam fetch individual.
- [ ] Concorrência máxima é 5.
- [ ] Requests duplicadas compartilham Promise.
- [ ] Roles têm uma fonte/cache.
- [ ] Identidade do servidor não regrediu.
- [ ] Endpoint de menções mantém shape.
- [ ] `npm run check` passa.
- [ ] Plano 005 marcado `DONE`.

## Condições de parada

- Fixtures reais mostrarem que `message.member` não contém os campos esperados.
- A mudança exigir privileged intent novo.
- Shape público precisar mudar.
- Testes só passarem aumentando TTL indefinidamente.

## Manutenção

- Gateway futuro pode invalidar membros/roles por evento.
- Multi-servidor futuro deve chavear todo cache por `guildId`.
