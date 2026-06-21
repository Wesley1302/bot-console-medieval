# Segredos do Projeto

Este projeto usa credenciais sensiveis para acessar a Discord REST API.

## Token do bot Discord

O token real do bot **nao deve ser salvo em Markdown, README, docs ou qualquer arquivo versionavel**.

Configure o token apenas em `.env`, que ja esta ignorado pelo Git:

```env
DISCORD_BOT_TOKEN=cole_o_token_real_aqui
DISCORD_GUILD_ID=cole_o_id_do_servidor_aqui
```

O arquivo `.env.example` deve manter apenas campos vazios ou placeholders.

## Rotacao obrigatoria

Se um token real for colado em chat, issue, commit, documento ou qualquer superficie compartilhada, trate como comprometido.

Procedimento recomendado:

1. Acesse o Discord Developer Portal.
2. Abra a aplicacao do bot.
3. Regenere o token do bot.
4. Atualize o valor local em `.env`.
5. Reinicie o backend.

## Regra operacional

Quando uma etapa futura precisar usar o bot real:

1. Ler `DISCORD_BOT_TOKEN` de `.env`.
2. Nunca imprimir o token em logs.
3. Nunca retornar o token em endpoints.
4. Nunca salvar o token em exports, automacoes ou arquivos de debug.
