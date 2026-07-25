# Plano 006: Tornar exportações limitadas, persistentes e eficientes

> **Instruções ao executor**: preserve os quatro arquivos finais e os endpoints.
> Implemente em etapas, sempre comparando uma fixture exportada antes/depois.
> Não teste com categoria real grande até autorização.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- server/src/services/exports.service.mjs server/src/routes/exports.routes.mjs server/exports tests/server`

## Status

- **Prioridade**: P1
- **Esforço**: L
- **Risco**: ALTO
- **Depende de**: planos 001 e 005
- **Categoria**: performance / confiabilidade
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

Jobs existem só em memória, não expiram e desaparecem em restart. Exportações
mantêm todo o histórico em arrays e fazem deduplicação O(n²). A V1 já processou
14 mil mensagens, então isso não é uma otimização hipotética: a próxima
categoria maior pode pressionar memória ou parecer travada.

## Estado atual

```js
// exports.service.mjs:11,90-91
const jobs = new Map();
jobs.set(job.id, job);
setTimeout(() => runExportJob(job.id), 0);
```

```js
// exports.service.mjs:158-160
const payload = await messagesService.listMessages(...);
messages.unshift(...payload.messages.filter(
  (message) => !messages.some((item) => item.id === message.id)
));
```

```js
// exports.service.mjs:285-290
await Promise.all([
  write manifest,
  write data JSON,
  write Markdown,
  write TXT
]);
```

## Contratos a preservar

- `POST /api/exports` retorna 202 com `jobId`.
- `GET /api/exports/jobs/:jobId` mantém campos atuais.
- Pasta final contém `manifest.json`, `data.json`, `export.md`, `export.txt`.
- Downloads JSON/MD/TXT e bulk combined/separate continuam.
- Nome e conteúdo legível permanecem semanticamente equivalentes.

## Comandos

| Objetivo | Comando | Esperado |
|---|---|---|
| Teste focado | `npm run test:server -- --test-name-pattern="export"` | todos passam |
| Gate | `npm run check` | exit 0 |
| Memória fixture | comando do teste de 20 mil mensagens | abaixo do teto documentado |

## Escopo

**Pode modificar/criar**:

- `server/src/services/exports.service.mjs`
- `server/src/services/export.repository.mjs` (criar)
- `server/src/services/export.renderer.mjs` (criar)
- `server/src/routes/exports.routes.mjs` somente para status 429/erros existentes
- `tests/server/exports*.test.mjs`
- `server/exports/.gitkeep` se necessário
- `plans/README.md`

**Não modificar**:

- formatos públicos/nomes finais;
- frontend;
- raiz persistente `server/exports`;
- limite de 50 IDs em bulk;
- adicionar PDF;
- apagar exportações existentes.

## Design mínimo

Estrutura por job/export:

```text
server/exports/
  .jobs/job_<id>.json
  .work/export_<id>/
    job.json
    conversations/<conversationId>.json
  export_<id>/
    manifest.json
    data.json
    export.md
    export.txt
```

Todos os writes de metadata usam arquivo temporário único + rename, como
`saveAutomation`.

Uma fila em processo é suficiente na V1:

- concorrência: 1 job;
- máximo inicial de 5 jobs queued;
- sexto retorna 429 amigável;
- estado persistido permite consulta após restart.

Não criar queue framework.

## Passos

### Passo 1: fixar golden fixtures

Criar fixture pequena contendo:

- canal vazio;
- dois autores com identidade do servidor;
- mensagem editada;
- menção e cargo;
- anexo, embed e sticker;
- duas conversas.

Gerar arquivos atuais como golden files normalizados:

- ignorar timestamps gerados/IDs variáveis;
- comparar estrutura JSON e conteúdo MD/TXT relevante;
- não usar dados reais.

**Verificar**: testes golden passam antes da refatoração.

### Passo 2: tornar deduplicação O(n)

Em `fetchAllMessagesForExport`:

- criar `seenIds = new Set()`;
- para cada página, inserir apenas IDs inéditos;
- não usar `.some` sobre o acumulado;
- contabilizar `totalMessages` somente para inéditas;
- manter ordem cronológica.

**Verificar**:

- páginas sobrepostas não duplicam;
- 20 mil mensagens usam comparação linear;
- golden outputs não mudam.

### Passo 3: persistir jobs e limitar fila

Criar `export.repository.mjs` com:

- `saveJobAtomic(job)`;
- `loadJob(id)`;
- `listRecoverableJobs()`;
- `deleteJobAfterRetention(id)`.

`getExportJob` deve:

1. consultar Map;
2. se ausente, ler `.jobs`;
3. retornar 404 somente se nenhum existe.

Persistir em mudanças de etapa/progresso relevantes, não a cada mensagem.

Adicionar fila:

- `queuedIds`;
- `activeJobId`;
- `drainQueue()` com `finally`;
- nenhuma Promise sem catch;
- falha sempre termina `error`.

**Verificar**:

- 6 jobs simultâneos: 5 aceitos/queued e sexto 429 (ajustar contagem se um já
  estiver running, mas documentar regra exata);
- Map não cresce após retenção;
- restart consegue consultar job terminal.

### Passo 4: checkpoint por conversa

Após baixar uma conversa:

1. salvar fragmento JSON em `.work/.../conversations`;
2. atualizar lista de IDs concluídos no job;
3. só então avançar progresso.

Em restart:

- job `running` volta para `queued`;
- conversas concluídas são reutilizadas;
- conversa incompleta é refeita;
- erros anteriores permanecem em metadata.

**Verificar**: teste encerra fake runner após conversa 1, recria serviço e
confirma que só conversa 2 é buscada.

### Passo 5: gerar arquivos finais incrementalmente

Separar renderização de I/O:

- helpers geram cabeçalho, bloco de conversa e rodapé;
- abrir handles para `data.json`, `export.md`, `export.txt`;
- ler um fragmento de conversa por vez;
- escrever vírgulas JSON corretamente;
- fechar handles em `finally`;
- gerar `manifest.json` por último;
- renomear `.work` para pasta final somente com todos os arquivos válidos.

Se falhar:

- pasta final não deve aparecer na listagem;
- `.work` fica marcada para retomada/limpeza;
- job termina `error`.

**Verificar**:

- `JSON.parse(data.json)` passa;
- golden semântico passa;
- teste de 20 mil mensagens não mantém todas simultaneamente.

### Passo 6: limitar bulk em memória

Antes de montar combined/ZIP:

1. usar `fs.stat` dos arquivos selecionados;
2. calcular tamanho total;
3. definir teto conservador documentado (ex.: 100 MiB) para implementação
   JSZip em memória;
4. acima do teto, retornar 413 amigável orientando baixar em lotes menores;
5. manter limite de 50.

Não adicionar biblioteca de streaming ZIP neste plano. Registrar como evolução
se houver demanda real.

**Verificar**: abaixo do teto baixa; acima retorna 413 sem alocar buffers.

### Passo 7: retenção e limpeza segura

- jobs terminais em `.jobs` podem expirar após período documentado;
- exportações finais nunca são apagadas automaticamente;
- `.work` abandonado só é removido se job terminal antigo ou explicitamente
  identificado;
- path traversal continua bloqueado;
- delete de export final não pode remover `.jobs` ou `.work` alheio.

**Verificar**: testes com IDs inválidos e paths irmãos.

## Critérios de conclusão

- [ ] Deduplicação é O(n).
- [ ] Job sobrevive restart.
- [ ] Um job sempre termina `done` ou `error`.
- [ ] Concorrência/fila têm limites.
- [ ] Export incompleto não aparece como final.
- [ ] Quatro arquivos finais mantêm contrato.
- [ ] Bulk grande falha antes de alocar.
- [ ] Goldens e `npm run check` passam.
- [ ] Plano 006 marcado `DONE`.

## Condições de parada

- Outputs atuais não puderem ser reproduzidos pelas fixtures.
- Migração ameaçar apagar pasta existente.
- Geração incremental exigir mudar shape de `data.json`.
- Teto de bulk for definido sem medir fixtures.
- Executor precisar usar categoria real para provar lógica.

## Manutenção

- Em multi-instância, a fila local precisará de lease compartilhado.
- PDF e anexos offline ficam fora deste plano.
