# Plano 004: Estabilizar sessão, polling e ciclo de requests do frontend

> **Instruções ao executor**: preserve a experiência atual: mensagens iniciais
> em ordem cronológica, composer fixo, atualização a cada 5 segundos, edição e
> exclusão refletidas, paginação sem pular para o fim. Corrija o ciclo de vida;
> não redesenhe componentes.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- src/App.jsx src/api/client.js src/components/messages src/components/forums src/components/exports/ExportJobToast.jsx src/components/automations/AutomationPanel.jsx`

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: `plans/001-criar-baseline-automatizada.md`
- **Categoria**: bug / frontend
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

Requests de canal/fórum não são canceladas quando a seleção muda, e o polling
de mensagens é recriado quando `messages` e `refreshStatus` mudam. Uma resposta
antiga pode substituir dados da seleção nova. Além disso, 401 após expiração da
sessão vira erro local em cada painel, sem retornar ao login.

## Estado atual

```jsx
// MessagePanel.jsx:54-75
useEffect(() => {
  async function loadMessages() { ... setMessages(payload.messages || []); }
  loadMessages();
}, [selectedChannel?.id, selectedChannel?.messageable]);
```

```jsx
// MessagePanel.jsx:132-139
useEffect(() => {
  const timer = window.setInterval(() => refreshLatestMessages(), 5000);
  return () => window.clearInterval(timer);
}, [messages, refreshStatus, selectedChannel?.id, selectedChannel?.messageable, status]);
```

```js
// api/client.js:19-22
if (!response.ok) {
  const message = ...;
  throw new Error(message);
}
```

`App.jsx` só descobre sessão uma vez, no bootstrap.

## Comandos

| Objetivo | Comando | Esperado |
|---|---|---|
| Teste focado | `npm run test:frontend -- --run src/components/messages src/api` | todos passam |
| Gate | `npm run check` | exit 0 |

## Escopo

**Pode modificar/criar**:

- `src/api/client.js`
- `src/App.jsx`
- `src/components/messages/MessagePanel.jsx`
- `src/components/messages/messageMerge.js` (criar)
- `src/components/forums/ForumThreadList.jsx`
- `src/components/exports/ExportJobToast.jsx`
- `src/components/automations/AutomationPanel.jsx`
- `src/hooks/usePolling.js` (criar somente se usado por 2+ componentes)
- testes `*.spec.js(x)` correspondentes
- `plans/README.md`

**Não modificar**:

- backend/API;
- frequência de 5 s de mensagens, 2 s de automações e 900 ms de export job;
- layout/CSS;
- regra de scroll;
- conteúdo de toasts;
- forma de paginação `before`.

## Passos

### Passo 1: preservar status e causa dos erros da API

Criar `ApiError extends Error` em `client.js` com:

- `status`;
- `payload`;
- `code` opcional se o backend enviar;
- mensagem amigável atual.

Fazer parse JSON dentro de `try/catch`; JSON inválido deve gerar mensagem
“Resposta inválida da API.” com status da resposta, não `SyntaxError` cru.

Preservar `credentials: 'include'`, FormData e downloads.

**Verificar**: testes 200 JSON, 204/vazio, erro JSON, erro texto, JSON inválido e
FormData.

### Passo 2: centralizar sessão expirada sem store externa

No `client.js`, quando uma rota protegida retorna 401:

- não disparar no `/api/auth/login`;
- emitir evento único `bcm:session-expired` no `window`;
- continuar lançando `ApiError` para a chamada local.

Em `App.jsx`:

- registrar/remover listener uma vez;
- limpar operador;
- mudar para `anonymous`;
- não chamar logout remoto (a sessão já é inválida);
- permitir novo login normalmente.

Evitar Context/Redux. O evento é suficiente para uma única sessão global.

**Verificar**: teste renderiza app autenticado, simula evento e confirma
`LoginScreen`; listener é removido no unmount.

### Passo 3: extrair merge puro de mensagens

Criar funções puras:

```js
mergeLatestMessages(current, latest)
prependOlderMessages(current, older)
```

Regras:

- sem duplicados por ID;
- últimas 50 substituem versões anteriores para refletir edição;
- mensagens removidas dentro da janela mais recente desaparecem;
- mensagens mais antigas já paginadas são preservadas;
- ordem cronológica;
- arrays de entrada não são mutados.

Cobrir:

- nova mensagem;
- edição;
- exclusão;
- janela sem interseção;
- canal vazio;
- paginação repetida.

**Verificar**: testes puros passam.

### Passo 4: cancelar carregamento inicial obsoleto

Em `MessagePanel`:

1. cada seleção cria `AbortController`;
2. passar `signal` via options até `apiFetch`;
3. no cleanup, abortar;
4. ignorar `AbortError`;
5. antes de setar estado, confirmar que o request pertence ao canal atual;
6. resetar query, threads e estados no início da seleção.

Se o fetch mock não respeitar abort, manter também um generation counter.

Aplicar o mesmo padrão a `ForumThreadList`.

**Verificar**: teste inicia canal A, troca para B, resolve B e depois A; somente
B aparece.

### Passo 5: tornar polling estável e sem sobreposição

Em `MessagePanel`:

- transformar refresh em callback estável;
- guardar `refreshInFlightRef`;
- intervalo depende somente de canal/status habilitado;
- se uma execução ainda está em voo, pular o tick;
- cleanup cancela intervalo e request ativo;
- usar `mergeLatestMessages`.

Não usar `messages` nem `refreshStatus` na dependência do efeito do intervalo.
Use atualização funcional de state.

**Verificar com fake timers**:

- exatamente uma request a cada 5 s;
- request lenta não sobrepõe;
- trocar de canal cancela timer antigo;
- unmount deixa zero timers.

### Passo 6: estabilizar pollings secundários

Aplicar helper compartilhado somente onde o padrão é realmente igual:

- `AutomationPanel`: polling apenas enquanto existe status `running`;
- `ExportJobToast`: polling até `done/error`, sem nova chamada após terminal;
- timers de esconder toast devem ser limpos no unmount.

Se as semânticas forem diferentes, mantenha efeitos locais; não force abstração.

**Verificar**:

- automação para de consultar após `done`;
- export chama `onDone` uma vez;
- troca de `jobId` cancela job anterior.

### Passo 7: preservar scroll

Testar `MessageList`:

- carga inicial vai ao fim;
- mensagem nova, quando operador já está perto do fim, mantém fim;
- carregar antigas não move para o fim e preserva posição visual;
- polling de edição sem novo ID não força scroll.

Se o comportamento atual de “sempre ir ao fim com nova mensagem” for mantido,
documentá-lo no teste. Não introduzir botão “novas mensagens” neste plano.

## Critérios de conclusão

- [ ] Resposta do canal anterior nunca aparece no canal atual.
- [ ] Não há polling sobreposto.
- [ ] Intervalos/listeners/timers são limpos.
- [ ] 401 protegido retorna à tela de login.
- [ ] Edição/exclusão remota na janela recente atualiza a lista.
- [ ] Paginação preserva posição e não duplica.
- [ ] `npm run check` passa.
- [ ] Plano 004 marcado `DONE`.

## Condições de parada

- A correção exigir mudar frequência ou contrato de API.
- O AbortController não puder ser propagado sem tocar arquivos fora do escopo;
  nesse caso pedir ampliação explícita.
- Testes mostrarem que o comportamento atual de scroll difere do descrito.
- A solução proposta exigir store global externa.

## Manutenção

- Gateway/SSE futuro deve alimentar as mesmas funções puras de merge.
- Toda nova tela com polling deve provar cleanup e no-overlap em teste.
