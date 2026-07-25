# Plano 001: Criar uma baseline automatizada que preserve a V1

> **Instruções ao executor**: siga cada passo, execute a verificação indicada e
> só avance quando ela passar. Não use Discord real, não leia `.env` e não
> altere produção. Ao terminar, atualize o status deste plano em
> `plans/README.md`.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- package.json package-lock.json vite.config.js server.mjs server/src src .github tests`
> Se qualquer arquivo em escopo mudou, compare os trechos abaixo com o código
> atual. Divergência de contrato é condição de parada.

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: BAIXO
- **Depende de**: nenhum
- **Categoria**: testes / DX
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

O repositório não possui testes, lint, CI ou um comando único de verificação.
Refatorar automações, polling, exportações e CSS sem caracterização automatizada
é o maior risco do projeto. Este plano cria uma rede mínima focada nos contratos
que já funcionam, sem perseguir cobertura percentual.

## Estado atual

- `package.json:6-12`:

```json
"scripts": {
  "dev": "vite --host 127.0.0.1",
  "dev:server": "node server.mjs",
  "dev:all": "concurrently \"npm run dev:server\" \"npm run dev\"",
  "build": "vite build",
  "preview": "vite preview --host 127.0.0.1",
  "start": "node server.mjs"
}
```

- Não há `.github/workflows`, ESLint ou testes versionados.
- `server.mjs:17-48` constrói o app e abre a porta no mesmo módulo. Isso impede
  teste HTTP em memória sem iniciar um processo.
- Funções puras já testáveis:
  - `channels.service.mjs`: `channelKind`, `normalizeChannel`, `buildChannelTree`.
  - `messages.service.mjs`: `normalizeMessage`.
  - `automations.service.mjs`: `validateAutomationInput`,
    `getAutomationSummary`.
  - `exports.service.mjs`: `buildExportData`, `renderMarkdown`, `renderText`.
  - `src/utils/insertAtCursor.js`: `insertAtCursor`.
- Contratos que não podem mudar:
  - `/api/health` é público.
  - `/api/auth/me` retorna `authenticated: false`, não 401, sem sessão.
  - rotas operacionais retornam 401 sem cookie.

## Ferramentas do executor

- Use `karpathy-guidelines` ou `ponytail` se disponíveis para manter o escopo.
- Use apenas fixtures locais e `supertest`; nunca chame a API Discord.

## Comandos necessários

| Objetivo | Comando | Resultado esperado |
|---|---|---|
| Instalar | `npm install` | exit 0; lockfile atualizado |
| Sintaxe | `npm run check:server` | exit 0 |
| Testes backend | `npm run test:server` | todos passam, zero rede externa |
| Testes frontend | `npm run test:frontend -- --run` | todos passam |
| Lint | `npm run lint` | exit 0, sem erro |
| Build | `npm run build` | Vite conclui e gera `dist` |
| Gate único | `npm run check` | exit 0 |

## Escopo

**Pode modificar/criar somente**:

- `package.json`
- `package-lock.json`
- `vite.config.js`
- `eslint.config.js` (criar)
- `server.mjs`
- `server/src/app.mjs` (criar)
- `tests/server/**/*.test.mjs` (criar)
- `src/**/*.spec.jsx` e `src/**/*.spec.js` (criar)
- `src/test/setup.js` (criar)
- `.github/workflows/check.yml` (criar)
- `plans/README.md`

**Não modificar**:

- regras de negócio dos serviços;
- formatos de resposta;
- CSS;
- `.env` e `.env.example`;
- deploy/PM2/Vercel;
- scripts em `.tmp`.

## Fluxo Git

- Branch sugerida: `refactor/001-verification-baseline`.
- Commits convencionais observados no Git; exemplo:
  `test: add v1 characterization baseline`.
- Não fazer push sem ordem do operador.

## Passos

### Passo 1: separar criação do app e abertura da porta

1. Criar `server/src/app.mjs` com `createApp()`.
2. Mover para essa função:
   - `express()`;
   - `trust proxy`;
   - CORS e JSON parser;
   - registro de todas as rotas;
   - static de `dist`;
   - error handler.
3. `createApp()` deve retornar o app e não abrir porta nem inicializar timers.
4. Manter em `server.mjs`:
   - `dotenv/config`;
   - `automationsService.initAutomations()`;
   - `createApp().listen(...)`;
   - logs de startup.
5. Não alterar ordem dos middlewares/rotas.

**Verificar**:

```powershell
node --check server.mjs
node --check server/src/app.mjs
```

Esperado: ambos exit 0.

### Passo 2: configurar testes sem rede real

Adicionar como `devDependencies`:

- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/user-event`
- `@testing-library/jest-dom`
- `supertest`

Mover ferramentas de build/desenvolvimento já existentes para `devDependencies`
somente se `npm install` não alterar versões resolvidas:

- `@vitejs/plugin-react`
- `vite`
- `concurrently`

Manter dependências usadas em runtime no backend/frontend em `dependencies`.

Configurar no `vite.config.js`:

```js
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.js',
  clearMocks: true,
}
```

Criar `src/test/setup.js` importando `@testing-library/jest-dom/vitest`.

**Verificar**: `npm install` → exit 0 e nenhum `npm audit fix`.

### Passo 3: escrever caracterização backend

Criar testes para:

1. `buildChannelTree`:
   - ordena categorias/canais;
   - cria `SEM CATEGORIA`;
   - omite voz da árvore;
   - mantém fóruns e threads ativas separadas.
2. `normalizeMessage`:
   - prefere nome/avatar do servidor;
   - preserva anexos, menções, cargos e timestamp editado;
   - tolera campos ausentes.
3. `validateAutomationInput`:
   - sequência válida;
   - agendamento válido;
   - rejeita passado, zero mensagens, mais de 100 e intervalo fora do limite.
4. renderização de export:
   - MD/TXT preservam conversa, autor do servidor, texto e URL de anexo;
   - `buildExportData` calcula totais.
5. HTTP via `createApp()` + `supertest`:
   - `GET /api/health` retorna 200 e `ok: true`;
   - `GET /api/status` sem cookie retorna 401;
   - `GET /api/auth/me` sem cookie retorna 200 com `authenticated: false`.

Use objetos inline pequenos. Não salve fixtures contendo IDs/nomes reais.

**Verificar**: `npm run test:server` → todos os casos passam e nenhuma request
externa aparece.

### Passo 4: escrever caracterização frontend mínima

Criar testes para:

1. `insertAtCursor` antes, no meio e substituindo seleção.
2. `LoginScreen`:
   - botão desabilitado vazio;
   - Enter chama `onLogin`;
   - erro rejeitado aparece.
3. `MobileNav`:
   - estado ativo de console/canais/downloads/automações;
   - callbacks corretos.
4. `MessageList`:
   - estado vazio;
   - agrupamento consecutivo do mesmo autor no mesmo minuto;
   - interrupção por outro autor cria grupo novo.

Se `groupMessages` precisar ser testado diretamente, extraia somente essa função
para `src/components/messages/messageGrouping.js` e atualize o import. Não
refatore `MessageList` além disso.

**Verificar**: `npm run test:frontend -- --run` → todos passam.

### Passo 5: adicionar lint cirúrgico

Usar configuração flat compatível com React/Vite:

- `eslint`
- `@eslint/js`
- `globals`
- `eslint-plugin-react-hooks`
- `eslint-plugin-react-refresh`

Aplicar a `src`, `server`, `server.mjs`, `vite.config.js` e testes. Ignorar
`dist`, `node_modules`, `.tmp`, `server/exports`, `server/automations`.

Não executar autoformatação global. Corrigir somente erros reais apontados;
warnings de estilo não devem gerar churn.

**Verificar**: `npm run lint` → exit 0.

### Passo 6: criar os scripts

Adicionar:

```json
"check:server": "node scripts/check-server-syntax.mjs",
"test:server": "node --test",
"test:frontend": "vitest",
"lint": "eslint .",
"check": "npm run check:server && npm run lint && npm run test:server && npm run test:frontend -- --run && npm run build"
```

Como glob de PowerShell/Bash difere, criar
`scripts/check-server-syntax.mjs` somente se necessário e adicioná-lo ao escopo
antes de editar. O script deve usar APIs Node para encontrar `.mjs` e
`spawnSync(process.execPath, ['--check', file])`; não usar shell.

**Verificar**: `npm run check` → exit 0.

### Passo 7: adicionar CI

Criar `.github/workflows/check.yml`:

- trigger em `pull_request` e push para `main`;
- Node 20;
- `npm ci`;
- `npm run check`;
- sem secrets e sem `.env`;
- timeout de 10 minutos.

**Verificar**: validar YAML e revisar que nenhum step inicia servidor ou Discord.

## Plano de testes

- Pelo menos 15 casos backend e 8 frontend.
- Nenhum teste depende de relógio real sem `mock`.
- Nenhum teste escreve em `server/exports` ou `server/automations`.
- Nenhum teste lê `.env`.

## Critérios de conclusão

- [ ] `npm run check` passa.
- [ ] `git grep -n "DISCORD_BOT_TOKEN=" -- ':!.env.example'` não encontra valor.
- [ ] `/api/health`, `/api/auth/me` e proteção 401 mantêm contratos.
- [ ] CI usa somente dados locais.
- [ ] Nenhum arquivo fora do escopo foi alterado.
- [ ] Linha do plano 001 em `plans/README.md` está `DONE`.

## Condições de parada

- O app não puder ser separado sem mudar ordem ou contrato de rotas.
- Um teste tentar acessar Discord/rede externa.
- A instalação exigir atualização major das dependências de runtime.
- O lint exigir reforma ampla em arquivos sem relação com o gate.
- Qualquer segredo aparecer em fixture, saída ou diff.

## Notas de manutenção

- Cobertura deve crescer por risco, não por porcentagem.
- Todo plano posterior deve adicionar o teste de regressão antes da correção.
- Não migrar para TypeScript neste plano.
