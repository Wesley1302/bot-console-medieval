# Relatorio De Deploy Gemini E Base Local

## Data

26/07/2026, America/Sao_Paulo.

## Objetivo

Ativar a analise generativa com Gemini, substituir o envio manual de arquivos
pela sincronizacao de uma base local privada e publicar a integracao no GitHub,
Oracle e Vercel sem versionar credenciais ou documentos privados.

## Publicacao

- GitHub privado: `Wesley1302/bot-console-medieval`.
- Frontend: `https://bot-console-medieval.vercel.app`.
- Oracle: release `/opt/bot-console-medieval/releases/20260726063136`.
- PM2: backend e worker online.
- Base privada: 21 documentos disponiveis e 47 chunks com embedding pronto.
- Embeddings: `gemini-embedding-2`, com 768 dimensoes.

## Limites Observados

Os numeros abaixo foram medidos com chamadas reais e concorrentes no projeto
Free Tier usado nesta rodada. Limites do Gemini sao aplicados por projeto e
modelo e podem mudar.

| Modelo | RPM observado | Limite interno |
| --- | ---: | ---: |
| `gemini-3.5-flash` | 5 | 4 |
| `gemini-3.6-flash` | 5 | 4 |
| `gemini-3.5-flash-lite` | 15 | 12 |
| `gemini-3.1-flash-lite` | 15 | 12 |
| `gemini-3.1-flash-lite-preview` | reserva validada | 12 |

Os modelos Flash principais tambem informaram cota diaria observada de 20
requisicoes por projeto/modelo. O RPM exato do modelo preview nao foi esgotado
para preservar a reserva diaria.

Referencia oficial:
https://ai.google.dev/gemini-api/docs/rate-limits

## Estrategia De Volume

1. Indexar mensagens e documentos uma vez, em lotes de embeddings.
2. Agregar o contexto localmente e fazer uma geracao por analise, nunca uma
   chamada generativa por mensagem.
3. Priorizar os modelos Flash mais fortes; usar Flash-Lite para volume e
   preview somente como reserva.
4. Respeitar limites internos abaixo do maximo observado, com fila, cooldown,
   retry e fallback automatico.
5. Exigir JSON estruturado e IDs de evidencias para tornar respostas
   verificaveis. O schema reduz erros de formato, mas nao garante sozinho a
   correcao semantica.
6. Quando todas as cotas diarias forem consumidas, aguardar a renovacao ou
   habilitar faturamento. Criar chamadas artificiais para burlar a cota nao e
   uma estrategia suportada.

Referencias:

- https://ai.google.dev/api/generate-content
- https://ai.google.dev/gemini-api/docs/structured-output
- https://ai.google.dev/api/embeddings
- https://ai.google.dev/gemini-api/docs/models/gemini-embedding-2

## Bugs Encontrados E Corrigidos

- Worker PM2 ainda apontava para uma release antiga; processo recriado na
  release atual.
- Cooldown terminava alguns milissegundos antes da janela; margem e repeticao
  controlada adicionadas.
- Respostas validas podiam vir com formato diferente do contrato; schema JSON
  e validacao de backend adicionados.
- Embeddings em lote retornavam 3072 dimensoes; configuracao corrigida para 768
  e tamanho validado.
- Vetores legados de mensagens conflitavam com consultas de 768 dimensoes;
  migracoes normalizaram os dados e a busca passou a filtrar dimensoes.
- Documentos normalizados nao voltavam para a fila; migracao de reprocessamento
  adicionada.

## Validacao Final

- `npm run check`: 53 testes backend, 16 frontend, lint e build aprovados.
- `npm run test:e2e`: 2 fluxos aprovados.
- Health, login, sessao, status e canais aprovados pelo alias Vercel.
- Consulta RAG real concluida com `gemini-3.5-flash-lite`.
- Resposta final usou 10 evidencias da base privada.
- Base final: 21 documentos, 47 chunks prontos e zero erros.
- Chave presente apenas nos ambientes ignorados e no `.env` restrito da VPS.
- Conteudo privado nao foi versionado.

## Status

**INTEGRACAO GEMINI E BASE LOCAL VALIDADAS EM PRODUCAO.**
