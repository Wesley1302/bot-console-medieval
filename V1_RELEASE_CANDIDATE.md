# V1 Release Candidate

## Status Geral

**Status: PRONTO PARA DEPLOY.**

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
- Logout desktop e mobile.
- Varredura de segredos aprovada.

## Riscos Conhecidos

- Persistencia local exige filesystem persistente no host.
- Categorias grandes podem demorar para exportar.
- O alvo compacto mobile permanece com 36px de altura por decisao visual.
- O modal de edicao nao foi reaberto visualmente no bug bash final, mas edicao real e componente foram aprovados anteriormente.
- Existe uma chave SSH fora da pasta do projeto; ela nao deve entrar no pacote de deploy.

## Proximo Passo

Preparar o deploy, configurar variaveis de producao, HTTPS e CORS, e executar smoke test pos-deploy.

## Checkpoint Git

- Checkpoint local preparado em 2026-06-20.
- Commit: `checkpoint: v1 ready for deploy`.
- Tag local: `v1-ready-for-deploy`.
- Status permanece `PRONTO PARA DEPLOY`, mas producao ainda nao foi validada.
- Push aguarda URL confirmada de repositorio GitHub privado.
