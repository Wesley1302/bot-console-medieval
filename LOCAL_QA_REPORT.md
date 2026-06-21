# Local QA Report

## Rodada

- Data: 2026-06-20.
- Ambiente: Windows, Node.js, Express, React, Vite e Discord REST API real.
- Variaveis verificadas, sem valores: `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `API_PORT`, `API_HOST`, `CORS_ORIGIN`, `ADMIN_PASSWORD`, `SESSION_SECRET`.

## Estado Do Projeto

- Backend e frontend funcionais.
- Integracao real com Discord aprovada.
- Restart de automacao aprovado.
- Exportacao de categoria grande concluiu posteriormente com 15 conversas e 14.012 mensagens.
- Frontend final auditado em seis dimensoes.

## Testes Backend Executados

- Health publico, auth, login, sessao, logout e status real.
- Categorias, canais, foruns, topicos e mensagens.
- Mensagem vazia com retorno `400`.
- Envio, upload, edicao e exclusao reais aprovados na rodada anterior.
- Exportacao de canal e forum, downloads individuais e em lote.
- Automacao curta ate `done`, pause, resume, cancel, delete e restart.

## Testes Frontend Executados

- Login desktop/mobile.
- Console vazio, canal, canal sem mensagens, forum e topico.
- Composer fixo e navegacao slim.
- Downloads com exportacao.
- Automacao sequencial e agendada.
- Logout mobile.
- Console e network sem erro critico.

## Responsividade

- 390x844: aprovado.
- 430x932: aprovado.
- 768x1024: aprovado.
- 1024x768: aprovado.
- 1440x1024: aprovado.
- 1920x1080: aprovado.
- Nenhum overflow horizontal global.

## Bugs Encontrados E Corrigidos

- Falha transitoria `504` em envio simples: reteste aprovado sem mudanca de codigo.
- Exportacao de categoria excedeu a primeira janela: concluiu posteriormente.
- CORS local em producao, favicon, recarga redundante, Downloads esticado, drawer translucido, header deslocado, estado vazio, labels e logout mobile: corrigidos no Prompt 11B.

## Testes Nao Executados

- Modal de edicao nao foi aberto na auditoria visual por ausencia de mensagem segura do bot no canal amostrado.
- Escritas Discord nao foram repetidas no Prompt 11B para evitar spam; os testes reais anteriores permanecem validos.

## Dados De Teste

- Mensagens de QA criadas anteriormente: removidas.
- Exportacoes de QA: removidas.
- Automacoes de QA: removidas.

## Riscos

- Filesystem persistente e obrigatorio para exports/automacoes.
- Deploy deve apontar somente para a pasta do projeto.
- Ambiente final precisa de HTTPS, CORS e cookies de producao.

## Recomendacao

**Pronto para deploy**, com smoke test pos-deploy obrigatorio.
