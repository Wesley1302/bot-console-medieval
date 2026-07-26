# V1 Release Candidate

## Status Geral

**Status: PRODUCAO VALIDADA.**

Data da aprovacao local: 2026-06-20.

## Funcionalidades Prontas

- Login com cookie HTTP-only.
- Status real do bot e guild.
- Canais, categorias, foruns e topicos.
- Leitura e atualizacao de mensagens.
- Envio com divisao automatica em blocos Discord.
- Upload, edicao e exclusao.
- Exportacoes JSON, Markdown e TXT.
- Downloads individuais e em lote.
- Automacoes sequenciais e mensagens agendadas.
- Pause, resume, cancel, delete e recuperacao apos restart.
- Frontend desktop/mobile medieval e responsivo.

## Fora Da V1

- PDF.
- WebSocket.
- Banco de dados externo.
- Multi-servidor.
- OAuth e usuarios multiplos.
- Anexos em automacoes.
- Recorrencia avancada.
- IA no bot.

## Evidencias Aprovadas

- Build e 22 checks ESM.
- Backend e frontend locais.
- Discord real: status, canais, mensagens e foruns.
- Escritas reais: texto, upload, edicao e exclusao.
- Exportacao de canal, forum e categoria.
- Downloads JSON, MD, TXT, combined e ZIP.
- Automacao real e restart.
- Viewports 390, 430, 768, 1024, 1440 e 1920.
- Zero overflow horizontal.
- Zero erro critico de console/rede apos correcoes.
- Rota backend de logout preservada; acao visual removida por decisao de produto.
- Varredura de segredos aprovada.

## Riscos Conhecidos

- Persistencia local exige filesystem persistente no host.
- Categorias grandes podem demorar para exportar.
- O alvo compacto mobile permanece com 36px de altura por decisao visual.
- O modal de edicao nao foi reaberto visualmente no bug bash final, mas edicao real e componente foram aprovados anteriormente.
- Existe uma chave SSH fora da pasta do projeto; ela nao deve entrar no pacote de deploy.
- O certificado IP Let’s Encrypt e de curta duracao e depende da renovacao
  automatica do Certbot.
- Os advisories npm devem ser triados separadamente, sem `npm audit fix`
  automatico.

## Proximo Passo

Monitorar certificado, PM2 e logs; executar o roadmap V2 apenas em mudancas
incrementais.

## Patch 12 - 2026-06-24

- Canais definido como tela inicial.
- Mencoes de usuarios, cargos, `@here` e `@everyone` adicionadas a automacoes sequenciais e agendadas.
- Avatar e nome reais do bot aplicados na sidebar.
- Acao visual Sair removida em desktop/mobile, sem remover o endpoint de logout.
- Build, API, responsividade e duas automacoes reais de mencao aprovados.
- Backend atualizado na release Oracle `20260624003841` e PM2 online.
- Patch publicado no mesmo projeto e alias `https://bot-console-medieval.vercel.app`.
- Root, assets e `/api/health` aprovados; validacao autenticada pela Vercel continua pendente ate TLS no backend.

## Checkpoint Git

- Checkpoint local preparado em 2026-06-20.
- Commit: `checkpoint: v1 ready for deploy`.
- Tag publicada: `v1-ready-for-deploy`.
- Repositorio privado: `Wesley1302/bot-console-medieval`.
- Backend Oracle publicado e validado em 2026-06-23.
- Frontend Vercel publicado em `https://bot-console-medieval.vercel.app`.
- CORS final aplicado.
- Login e producao autenticada foram validados apos a ativacao do TLS.

## Producao TLS - 25/07/2026

- Refatoracao publicada no GitHub nos commits `3591d9d` e `d4d4731`.
- Backend atualizado na release `/opt/bot-console-medieval/releases/20260725054058`.
- Nginx e certificado Let’s Encrypt para o IP publico configurados.
- Express restrito a `127.0.0.1:8787`; acesso publico direto bloqueado.
- Rewrite da Vercel atualizado para upstream HTTPS.
- Alias `https://bot-console-medieval.vercel.app` preservado.
- Health, login, cookie seguro, sessao, status real e canais reais aprovados
  ponta a ponta.

## Gemini E Base Local - 26/07/2026

- Painel de upload manual da base removido.
- Base privada local sincronizada sem entrar no Git.
- 21 documentos e 47 chunks prontos na Oracle.
- Fallback Gemini, fila, cooldown e JSON estruturado validados.
- Embeddings normalizados em 768 dimensoes.
- Consulta RAG real concluida com evidencias privadas.
- Release Oracle `/opt/bot-console-medieval/releases/20260726063136`.
- Frontend preservado em `https://bot-console-medieval.vercel.app`.
- Status: **PRODUCAO VALIDADA COM IA GEMINI.**
