# Gemini Free Tier E Conhecimento Local

## Modelo De Conhecimento

O assistente usa RAG, nao fine-tuning. Os textos da pasta configurada em
`KNOWLEDGE_SOURCE_PATH` sao copiados para o armazenamento persistente, divididos
em trechos, convertidos em embeddings e pesquisados junto das mensagens do
Discord.

O painel nao oferece upload, exclusao ou reprocessamento manual de documentos.
A fonte controlada e a pasta de conhecimento sincronizada pelo operador.

Arquivos aceitos pela sincronizacao:

- Markdown (`.md`);
- texto simples (`.txt`);
- subpastas, pesquisadas recursivamente;
- links simbolicos sao ignorados.

## Sincronizar A Pasta

Primeiro valide sem banco e sem copiar dados:

```bash
npm run knowledge:sync -- --source "D:\caminho\da\base" --dry-run
```

Para registrar os documentos no PostgreSQL:

```bash
npm run db:migrate
npm run knowledge:sync -- --source "D:\caminho\da\base"
npm run worker
```

Cada arquivo recebe uma `source_key` derivada do caminho relativo e um
`source_hash` SHA-256. Uma segunda sincronizacao nao cria duplicatas. Arquivos
alterados voltam para a fila de processamento; arquivos identicos permanecem
inalterados.

Os textos da fonte e as copias em `server/knowledge` nao devem ser versionados.

## Modelos Verificados

Verificacao real executada em 26/07/2026 com uma geracao minima por modelo:

| Ordem | Modelo | Free Tier observado | Papel | Limite interno |
|---|---|---:|---|---:|
| 1 | `gemini-3.5-flash` | 5 RPM | maior qualidade | 4 RPM |
| 2 | `gemini-3.6-flash` | 5 RPM | equilibrio e baixa latencia | 4 RPM |
| 3 | `gemini-3.5-flash-lite` | 15 RPM | alto volume | 12 RPM |
| 4 | `gemini-3.1-flash-lite` | 15 RPM | ultimo fallback estavel | 12 RPM |
| 5 | `gemini-3.1-flash-lite-preview` | reserva validada, RPM nao esgotado | contingencia final | 12 RPM |

`gemini-embedding-2` respondeu HTTP 200 e foi validado com 768 dimensoes.

Os valores foram confirmados em 26/07/2026 no `QuotaFailure` retornado pela API,
com o identificador `GenerateRequestsPerMinutePerProjectPerModel-FreeTier`.
Eles sao aplicados por projeto e modelo, podem mudar e devem ser conferidos no
Google AI Studio. A capacidade nominal combinada e 40 RPM; a aplicacao limita-se
a 32 RPM nos quatro modelos medidos para manter margem operacional. O modelo
preview nao entra nessa soma porque uma rajada ate `429` consumiria sua cota
diaria restante; ele foi validado com contexto real e resposta estruturada 200.

Durante a validacao, `gemini-3.5-flash` e `gemini-3.6-flash` informaram tambem
20 requisicoes por dia por projeto/modelo no Free Tier. RPM e RPD sao limites
independentes: distribuir chamadas evita estouro por minuto, mas nao cria cota
diaria adicional.

## Estrategia De Fallback

O roteador:

1. tenta os modelos na ordem configurada em `AI_MODELS`;
2. respeita a janela local definida em `AI_MODEL_RPM_LIMITS`;
3. pula modelos em cooldown;
4. troca de modelo em `404` de modelo, `408`, `429`, timeout e `5xx`;
5. nao mascara `400`, `401` ou `403`, pois indicam requisicao ou credencial
   invalida;
6. se todos estiverem temporariamente limitados, espera a menor janela,
   acrescenta uma margem de 250 ms e tenta ate mais duas rodadas;
7. usa o preview apenas como contingencia final, depois dos modelos estaveis.

Essa estrategia distribui carga sem tentar burlar as cotas do provedor.

## Grandes Volumes E Controle De Alucinacao

- Mensagens sao indexadas e convertidas em embeddings em lotes de ate 100.
- Uma consulta recupera apenas as evidencias relevantes e faz uma unica chamada
  generativa, em vez de chamar o modelo para cada mensagem.
- O contexto e limitado por tamanho e quantidade de evidencias.
- O modelo deve responder em JSON e so pode citar IDs recuperados.
- A API recebe um JSON Schema explicito e o backend valida novamente a resposta.
- A resposta separa fatos, interpretacoes, hipoteses e limitacoes.
- O backend descarta IDs de evidencia inexistentes.
- A analise de milhares de mensagens continua usando uma chamada generativa por
  pergunta; as mensagens sao indexadas e recuperadas localmente antes dela.

Nenhum modelo generativo garante ausencia absoluta de alucinacao. O RAG, a
validacao de IDs e a exibicao das fontes tornam erros detectaveis e reduzem esse
risco sem sacrificar a capacidade de analisar grandes historicos.

## Configuracao

```env
AI_PROVIDER=gemini
AI_API_KEY=
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gemini-3.5-flash
AI_MODELS=gemini-3.5-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-3.1-flash-lite-preview
AI_MODEL_RPM_LIMITS=gemini-3.5-flash:4,gemini-3.6-flash:4,gemini-3.5-flash-lite:12,gemini-3.1-flash-lite:12,gemini-3.1-flash-lite-preview:12
AI_MODEL_COOLDOWN_MS=60000
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIMENSIONS=768
KNOWLEDGE_SOURCE_PATH=
```

Nunca registre `AI_API_KEY` no Git, em logs ou em documentacao.

## Referencias Oficiais

- Modelos: <https://ai.google.dev/gemini-api/docs/models>
- Limites: <https://ai.google.dev/gemini-api/docs/rate-limits>
- Embeddings: <https://ai.google.dev/gemini-api/docs/embeddings>
- Saidas estruturadas: <https://ai.google.dev/gemini-api/docs/structured-output>
