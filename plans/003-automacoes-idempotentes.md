# Plano 003: Tornar automações idempotentes e livres de corrida

> **Instruções ao executor**: primeiro escreva testes que reproduzam a corrida;
> depois altere a máquina de estados. Não envie mensagens reais durante os
> testes. Não mude rotas ou shape público sem preservar compatibilidade.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- server/src/services/automations.service.mjs server/src/services/messages.service.mjs server/src/routes/automations.routes.mjs tests/server`

## Status

- **Prioridade**: P0
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: `plans/001-criar-baseline-automatizada.md`
- **Categoria**: bug / arquitetura
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

Pausar ou cancelar durante uma request ao Discord pode deixar a mensagem como
`sending` apesar de ela já ter sido publicada. Ao retomar, o código reenvia.
Reinício durante envio também é ambíguo. Como automações são uma capacidade
central, a V2 precisa de entrega idempotente antes de recorrência ou templates.

O endpoint oficial Create Message suporta `nonce` de até 25 caracteres e
`enforce_nonce: true`, que devolve a mensagem existente quando o mesmo autor
repete o nonce nos minutos recentes. Use isso como proteção da borda, além da
máquina de estados local.

## Estado atual

```js
// automations.service.mjs:259-273
message.status = 'sending';
await saveAutomation(automation);
const result = await messagesService.sendMessage(...);
if (automation.status !== 'running') {
  await saveAutomation(automation);
  return;
}
```

```js
// automations.service.mjs:324-328
if (message && ['error', 'sending'].includes(message.status)) {
  message.status = 'queued';
  message.error = null;
}
```

`messagesService.sendMessage` já divide textos longos e retorna `messages`, mas
não recebe chave idempotente e a automação só guarda o ID da última parte.

## Comandos

| Objetivo | Comando | Esperado |
|---|---|---|
| Teste focado | `npm run test:server -- --test-name-pattern="automation"` | todos passam |
| Gate | `npm run check` | exit 0 |
| Sintaxe | `node --check server/src/services/automations.service.mjs` | exit 0 |

## Escopo

**Pode modificar/criar**:

- `server/src/services/automations.service.mjs`
- `server/src/services/messages.service.mjs`
- `server/src/services/automation.repository.mjs` (criar, se necessário)
- `server/src/utils/deliveryNonce.mjs` (criar)
- `tests/server/automations.service.test.mjs`
- `tests/server/messages.service.test.mjs`
- `plans/README.md`

**Não modificar**:

- rotas e respostas públicas;
- frontend;
- formatos existentes de arquivos, exceto adicionar campos opcionais;
- automações reais sem migração;
- intervalo, limite de 100 mensagens ou modos existentes.

## Decisões obrigatórias

1. Sem banco e sem fila externa neste plano.
2. Um timer e no máximo um tick em voo por automação.
3. Pause/cancel não “desenvia” uma request já iniciada:
   - se o Discord confirmou, registrar `sent`;
   - manter a automação `paused`/`cancelled`;
   - não agendar a próxima.
4. Cada chunk de até 2.000 caracteres recebe nonce estável próprio.
5. Campos novos no JSON são opcionais ao carregar arquivos legados.

## Passos

### Passo 1: criar harness determinístico

Refatorar somente o necessário para instanciar o serviço com:

- `messages` adapter;
- diretório de persistência;
- relógio `now()`;
- `setTimer`/`clearTimer`.

Preferência:

```js
export function createAutomationsService(dependencies) { ... }
export const automationsService = createAutomationsService(prodDependencies);
```

Não criar container de DI genérico. O singleton exportado deve manter a API
atual.

Nos testes, usar diretório temporário e fake message service com Promise
controlável.

**Verificar**: testes existentes do plano 001 continuam passando.

### Passo 2: reproduzir a corrida antes de corrigir

Criar teste:

1. automação running com uma mensagem;
2. iniciar tick e manter fake send pendente;
3. executar pause;
4. resolver send com mensagem Discord;
5. confirmar resultado desejado:
   - mensagem local `sent`;
   - `currentIndex` avançou;
   - automação continua `paused`;
   - `nextRunAt = null`;
   - nenhum timer novo;
6. resume não chama send para a mensagem já confirmada.

Criar equivalente para cancel e para dois ticks simultâneos.

**Verificar antes da correção**: ao menos o teste pause/resume deve falhar pelo
comportamento atual. Se ele já passa, parar por drift.

### Passo 3: gerar nonces persistentes

Criar helper:

```js
deliveryNonce(automationId, messageId, chunkIndex) -> string <= 25
```

Requisitos:

- determinístico;
- caracteres aceitos pelo Discord;
- não conter texto da mensagem;
- colisão impraticável (hash SHA-256 truncado);
- mesmo input produz mesmo nonce após restart.

Ao normalizar nova mensagem de automação, persistir `deliveryKey` ou derivar de
IDs persistidos. Ao carregar legado, derivar sem reescrever até o próximo save.

**Verificar**: teste de estabilidade, tamanho e diferença por chunk.

### Passo 4: estender envio sem quebrar consumidores

Adicionar parâmetro opcional a `sendMessage`:

```js
sendMessage({ channelId, content, files, allowedMentions, deliveryKey })
```

Para cada chunk:

- incluir `nonce`;
- incluir `enforce_nonce: true`;
- usar nonce diferente por índice;
- aplicar tanto JSON quanto `payload_json` de multipart.

Sem `deliveryKey`, manter comportamento manual atual.

Retorno deve continuar:

```js
{ ok: true, message: lastMessage, messages: allMessages }
```

**Verificar**: testes inspecionam payloads JSON e multipart sem rede.

### Passo 5: serializar ticks

Adicionar `inFlight = new Set()` privado à instância do serviço:

1. se ID já está em voo, retornar sem executar;
2. adicionar antes da primeira mutação;
3. remover em `finally`;
4. timer disparado deve ser removido do mapa antes do tick;
5. `scheduleAutomation` sempre cancela timer anterior.

**Verificar**: duas chamadas simultâneas geram uma chamada ao fake Discord.

### Passo 6: reconciliar sucesso antes do estado de controle

Depois de `sendMessage` resolver:

1. marcar a mensagem `sent`;
2. persistir todos os IDs em `discordMessageIds` e manter
   `discordMessageId` com o último para compatibilidade;
3. avançar `currentIndex`;
4. atualizar `startedAt`/`lastError`;
5. então avaliar status:
   - `running`: concluir ou agendar próxima;
   - `paused`: `nextRunAt = null`, salvar, não agendar;
   - `cancelled`: manter `completedAt`, salvar, não agendar.

No catch:

- não sobrescrever `cancelled` ou `paused` com `error`;
- registrar erro na mensagem e `lastError`;
- para `running`, usar status `error` como hoje.

**Verificar**: matriz de testes running/paused/cancelled × success/error.

### Passo 7: tratar restart com `sending`

No carregamento:

- `sent` continua sent;
- `queued` continua queued;
- `sending` de processo anterior volta a `queued`, mas mantém a mesma
  `deliveryKey`, permitindo deduplicação via nonce;
- persistir a normalização antes de agendar.

Adicionar teste que:

1. salva `sending`;
2. cria nova instância do serviço;
3. inicializa;
4. fake Discord responde como deduplicado;
5. resultado final é `sent` uma única vez.

**Verificar**: restart test passa sem timer real.

### Passo 8: migrar sem quebrar arquivos legados

Fixtures:

- automação antiga sem `mode`;
- sem `deliveryKey`;
- com `discordMessageId` singular;
- scheduled e sequence.

Carregar, listar e salvar deve preservar os campos conhecidos e adicionar apenas
os novos opcionais.

## Critérios de conclusão

- [ ] Corrida pause/send/resume não duplica.
- [ ] Corrida cancel/send não duplica.
- [ ] Dois ticks simultâneos fazem um envio.
- [ ] Restart em `sending` reutiliza nonce.
- [ ] Mensagem longa persiste todos os IDs de chunks.
- [ ] Arquivos legados carregam.
- [ ] API pública não mudou.
- [ ] `npm run check` passa.
- [ ] Plano 003 marcado `DONE`.

## Condições de parada

- A documentação Discord vigente não oferece `enforce_nonce`.
- O executor só consegue testar usando Discord real.
- A correção exige mudar ações/rotas públicas.
- Arquivos legados reais não batem com as fixtures documentadas.
- Um teste revela que o Discord aceita nonce por menos tempo que o restart
  operacional esperado; nesse caso registrar risco e pedir decisão.

## Manutenção

- `enforce_nonce` protege duplicações recentes, não substitui persistência.
- Uma futura fila multi-instância deve usar lease/lock compartilhado.
- Recorrência V2 só pode começar depois deste plano.
