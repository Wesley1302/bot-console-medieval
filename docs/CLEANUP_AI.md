# Limpeza Em Massa E Assistente De IA

## Arquitetura

As duas capacidades preservam a arquitetura Express/React existente:

- `server.mjs`: API HTTP e rotas protegidas.
- `worker.mjs`: limpeza, consultas de IA, documentos, Gateway e reconciliacao.
- PostgreSQL: fila persistente, indice pesquisavel e progresso dos jobs.
- pgvector: embeddings de mensagens e documentos.
- Discord REST v10: fonte oficial e execucao das exclusoes.
- Discord Gateway: replica eventos de criacao, edicao e exclusao.

O indice local nao e historico permanente. Uma mensagem apagada e removida
fisicamente de `indexed_messages`; evidencias antigas perdem o trecho e ficam
marcadas como indisponiveis.

## Ativacao Local

1. Inicie PostgreSQL com pgvector:

```bash
docker compose -f docker-compose.pgvector.yml up -d
```

2. Configure `.env` sem versionar segredos:

```env
DATABASE_URL=postgresql://bot_console:local-development-only@127.0.0.1:5432/bot_console_medieval
DATABASE_SSL=false
AI_PROVIDER=gemini
AI_API_KEY=
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_MODEL=gemini-3.5-flash
AI_MODELS=gemini-3.5-flash,gemini-3.6-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite
AI_MODEL_RPM_LIMITS=gemini-3.5-flash:4,gemini-3.6-flash:4,gemini-3.5-flash-lite:12,gemini-3.1-flash-lite:12
AI_MODEL_COOLDOWN_MS=60000
EMBEDDING_MODEL=gemini-embedding-2
EMBEDDING_DIMENSIONS=768
KNOWLEDGE_STORAGE_PATH=server/knowledge
KNOWLEDGE_SOURCE_PATH=
JOB_CONCURRENCY=2
MESSAGE_SYNC_CONCURRENCY=3
RECONCILIATION_INTERVAL_MINUTES=60
AI_MAX_EVIDENCES=30
AI_MAX_CONTEXT_TOKENS=24000
DISCORD_GATEWAY_ENABLED=true
WORKER_POLL_INTERVAL_MS=1500
```

3. Execute a migracao:

```bash
npm run db:migrate
```

4. Inicie API, frontend e worker em terminais separados:

```bash
npm run dev:server
npm run dev
npm run worker
```

Sem `DATABASE_URL`, a aplicacao principal continua funcionando, mas rotas de
limpeza, IA e documentos retornam erro de configuracao. Sem as variaveis de IA,
limpeza continua disponivel, enquanto embeddings e consultas ao modelo falham
com mensagem explicita.

## Limpeza

No menu contextual de categoria, canal, forum ou topico:

1. Abra `Limpar`.
2. Revise escopo, estimativa e locais inacessiveis.
3. Em categoria/forum, digite a confirmacao textual exata.
4. Inicie e acompanhe processadas, excluidas, falhas e ignoradas.

O token de confirmacao expira em 15 minutos. Mensagens recentes podem usar bulk
delete; mensagens antigas sao excluidas individualmente. Pausa e cancelamento
ocorrem entre lotes, preservando uma chamada que ja esteja em andamento.

## Assistente De IA

Na aba `IA`:

1. Selecione um ou mais locais.
2. Escolha todo o historico, desde, ate ou intervalo.
3. Escreva a pergunta.
4. Acompanhe resolucao, sincronizacao, busca e analise.
5. Revise resposta e evidencias.

Perguntas factuais com ID de usuario usam consulta estruturada. Consultas
semanticas e narrativas recuperam apenas evidencias relevantes antes da chamada
ao modelo. A resposta do modelo precisa ser JSON validavel e so pode citar IDs
de evidencias recuperados.

## Conhecimento Local

O upload manual foi removido do painel. A base e sincronizada a partir da pasta
configurada em `KNOWLEDGE_SOURCE_PATH`:

```bash
npm run knowledge:sync -- --dry-run
npm run knowledge:sync
```

A sincronizacao aceita Markdown e TXT, e idempotente e so reprocessa arquivos
alterados. Os arquivos ficam em `KNOWLEDGE_STORAGE_PATH`; chunks e embeddings
ficam no PostgreSQL. Consulte `docs/GEMINI_KNOWLEDGE.md` para a estrategia de
modelos, cotas e fallback.

## Rollback

Pare primeiro o worker. Para remover apenas as tabelas novas:

```bash
psql "$DATABASE_URL" -f scripts/rollback-cleanup-ai.sql
```

O rollback e destrutivo para jobs, indice e documentos registrados. Ele nao
apaga mensagens nem estruturas no Discord. Faça backup do PostgreSQL e da pasta
de conhecimento antes de executar.

## Limitacoes Da V1

- Nao existe treinamento ou fine-tuning.
- O Gateway depende dos intents e permissoes concedidos ao bot.
- O indice inicial de escopos muito grandes pode ser demorado.
- A estimativa da previa usa o indice local e pode ser menor antes da primeira sincronizacao.
- Documentos PDF preservam texto, mas a pagina pode ficar indisponivel quando o parser nao fornece mapeamento confiavel.
- Nao existe painel de metricas agregado; eventos operacionais ficam em logs estruturados e `technical_events`.
- A sincronizacao real da pasta e a configuracao do provedor devem ser aplicadas em cada ambiente.
