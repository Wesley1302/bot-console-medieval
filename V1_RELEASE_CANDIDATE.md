# V1 Release Candidate

## Status Geral

**Status: PATCH PUBLICADO NA VERCEL, AGUARDANDO VALIDACAO FINAL.**

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
- A API ainda precisa de HTTPS antes de receber credenciais pela internet.
- `CORS_ORIGIN` ainda precisa apontar para a URL final da Vercel.

## Proximo Passo

Configurar HTTPS no backend Oracle, atualizar o rewrite e executar smoke test autenticado ponta a ponta.

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
- Login e producao autenticada permanecem bloqueados ate TLS no backend.
