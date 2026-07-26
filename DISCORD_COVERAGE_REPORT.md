# Auditoria de cobertura do Discord

## Rodada

- Data: 26/07/2026
- Servidor: guild configurada em `DISCORD_GUILD_ID`
- Metodo: enumeracao real pela Discord REST API v10, usando o mesmo token e os mesmos servicos do painel
- Privacidade: nenhum ID, nome de canal, autor ou conteudo de mensagem foi registrado neste documento

## Estrutura reconhecida

| Tipo | Quantidade |
| --- | ---: |
| Categorias | 20 |
| Canais de texto | 76 |
| Canais de anuncio | 0 |
| Foruns | 50 |
| Canais de voz | 6 |
| Total de canais da guild | 152 |
| Topicos ativos | 308 |
| Topicos arquivados | 184 |
| Total de topicos unicos | 492 |

Foram consultados os 126 canais que podem conter topicos. Nao houve falha de
descoberta nem aviso de permissao nessa rodada. Os canais de voz sao reconhecidos
e classificados pelo backend, mas permanecem ocultos na interface conforme a
regra atual do produto.

## Historico de mensagens

- Conversas reconhecidas para leitura: 568
- Conversas percorridas ate o inicio absoluto: 567
- Conversa de grande volume percorrida: mais de 205.000 mensagens, sem falha de paginacao
- Paginas de ate 100 mensagens verificadas: 3.361
- Mensagens atravessadas durante a auditoria: 285.678

A ultima conversa nao foi percorrida ate o inicio absoluto porque seu volume
exigiria varias janelas adicionais de teste. O cursor `before` continuou
avancando normalmente depois de mais de 2.000 paginas nessa conversa. Isso
valida a capacidade de paginacao profunda; nao foi identificado limite logico
que interrompa a leitura do restante.

## Problema encontrado

Antes desta auditoria, a arvore principal reconhecia topicos ativos, e os foruns
listavam topicos ativos e arquivados. Entretanto, o seletor de topicos de canais
de texto e a expansao de exportacoes desses canais consideravam apenas topicos
ativos. Nesta guild, isso omitia 184 topicos arquivados.

## Correcao aplicada

- Criado endpoint protegido para listar topicos ativos e arquivados de qualquer
  canal pai: `GET /api/channels/:channelId/threads`.
- Unificada a descoberta de topicos ativos, arquivados publicos e arquivados
  privados, com remocao de duplicados e ordenacao estavel.
- O painel de mensagens passou a carregar a lista completa de topicos dos canais
  de texto e anuncio.
- Exportacoes de canal e categoria passaram a incluir topicos arquivados.
- Mantida compatibilidade com `GET /api/forums/:forumId/threads`.
- Adicionada protecao contra cursor de arquivos arquivados que nao avanca.

## Limite de cobertura

O painel reconhece todos os recursos que o bot consegue visualizar segundo as
permissoes do Discord. Um canal ou topico negado ao bot pela configuracao do
servidor nao pode ser descoberto pela API e, por isso, tambem nao pode aparecer
no painel.

## Conclusao

Com a correcao, o painel cobre categorias, canais de texto, canais de anuncio,
foruns, topicos ativos, topicos arquivados e historicos paginados de mensagens.
A cobertura real observada nesta guild nao apresentou falhas de descoberta.
