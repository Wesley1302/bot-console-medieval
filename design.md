# Design System — Bot Console Medieval

Data: 2026-06-19

## Identidade

`bot-console-medieval` e uma mesa de comando para operar um bot Discord. A interface deve parecer um painel de conselho em castelo: pedra, ferro, ouro envelhecido, vinho e pergaminho. O produto e operacional, nao promocional.

## Principios

1. Tarefa primeiro: o operador deve chegar rapido a canais, mensagens, downloads e automacoes.
2. Fantasia contida: o tema aparece em cor, borda, textura CSS e microdetalhes, nao em decoracao pesada.
3. Controle claro: toda acao sensivel deve parecer deliberada.
4. Densidade legivel: dashboards e listas devem ser escaneaveis em desktop e mobile.
5. Sem segredos na UI: tokens, senhas e headers nunca aparecem.

## Paleta

| Token | Uso |
| --- | --- |
| `--color-void` | Fundo base quase preto. |
| `--color-stone` | Superficies principais. |
| `--color-stone-2` | Superficies elevadas. |
| `--color-iron` | Bordas e trilhos. |
| `--color-gold` | Acoes, foco e selecao. |
| `--color-gold-soft` | Hover e fundos sutis. |
| `--color-wine` | Perigo, erro e cancelamento. |
| `--color-parchment` | Texto de alto contraste. |
| `--color-text` | Texto padrao. |
| `--color-muted` | Texto secundario. |
| `--color-success` | Estados positivos. |
| `--color-info` | Estados informativos. |

## Tipografia

- Usar apenas system fonts.
- H1 apenas em login e telas de boas-vindas.
- Labels, botoes e navegacao usam peso forte, sem fontes fantasia.
- Escala fixa, sem `vw` para tamanho de fonte.
- `letter-spacing: 0` como regra padrao.

## Layout

### Desktop

- Sidebar fixa com largura aproximada de 320px.
- TopBar fixa no fluxo, com navegacao principal.
- Conteudo com largura livre, sem esmagar chat.
- MessagePanel ocupa a area central com composer ancorado ao fim do painel.

### Mobile

- Sidebar vira painel lateral/sobreposto.
- MobileNav fixa no rodape com alvos tocaveis.
- Composer, downloads e automacoes empilham.
- Sem scroll horizontal.

## Componentes Base

### Button

- Primario: ouro envelhecido e fundo escuro.
- Ghost: navegacao e acoes secundarias.
- Danger: exclusao/cancelamento.
- Foco sempre visivel.
- Hover curto com `translateY(-1px)`.

### Card

- Usado para blocos independentes, formularios, itens repetidos e modais.
- Raio maximo de 8px na maior parte da UI.
- Borda metalica e sombra curta.
- Nao aninhar cards como layout principal.

### Badge

- Pequeno, legivel e sem depender apenas de cor.
- Tons: gold, running, paused, error, done, cancelled, sent, queued.

### Modal

- Fundo escuro translucidado.
- Conteudo estreito, foco visual claro.
- Acoes alinhadas ao fim.

## Componentes de Produto

### ChannelTree

- Categorias recolhiveis.
- Item selecionado com borda/acento dourado.
- Forum e topico diferenciados por icone e estado; voz fica oculta.
- Busca sempre visivel.

### MessagePanel

- Estado vazio claro.
- Mensagens em ordem cronologica.
- Acoes de editar/apagar discretas.
- Composer no fim, com anexos visiveis.

### DownloadsPanel

- Toolbar de lote no topo.
- Exportacoes como itens escaneaveis.
- Formatacao e modo agrupados.

### AutomationPanel

- Formulario e lista lado a lado no desktop.
- Cards com progresso, status e acoes diretas.
- Em mobile, formulario e lista empilhados.

## Motion

- Duracao padrao: 160ms a 240ms.
- Usar `ease-out`.
- Movimento apenas para hover, foco, entrada, progresso e feedback.
- Respeitar `prefers-reduced-motion`.

## Acessibilidade

- Contraste alto em texto e controles.
- `:focus-visible` em botoes, links, inputs e selects.
- Areas clicaveis com minimo visual confortavel.
- Textos longos devem quebrar linha ou usar ellipsis em listas.
- Nenhuma informacao importante depende apenas de cor.

## Nao Fazer

- Nao usar imagens externas.
- Nao copiar Game of Thrones ou marcas protegidas.
- Nao adicionar Tailwind, shadcn, GSAP ou bibliotecas novas.
- Nao criar landing page.
- Nao aplicar hero comercial.
- Nao usar orbes, bokeh, particulas ou decoracao sem funcao.
- Nao alterar backend, endpoints, `.env` ou regras de negocio nesta etapa.
