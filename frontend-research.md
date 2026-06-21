# Frontend Research — Bot Console Medieval

Data: 2026-06-19

## Objetivo
Definir referencias visuais e decisoes de interface para o acabamento final da V1 do `bot-console-medieval`, mantendo React, Vite, lucide-react e CSS puro. Esta pesquisa nao altera backend, regras de negocio nem integracao Discord.

## Fontes Consultadas

| Fonte | Uso nesta V1 | Decisao |
| --- | --- | --- |
| React Bits — https://www.reactbits.dev/ | Referencia de componentes animados React. | Usar apenas a ideia de microinteracoes leves; nao importar biblioteca. |
| 21st.dev — https://21st.dev/community/components | Catalogo de padroes como sidebars, buttons, cards, dialogs e inputs. | Priorizar componentes operacionais densos, nao landing page. |
| shadcn/ui — https://ui.shadcn.com/ | Inspiracao de design system aberto, componentes compostos e dashboard. | Manter componentes proprios com classes previsiveis, sem instalar shadcn. |
| Magic UI — https://magicui.design/ | Referencia de animacoes e componentes abertos. | Evitar efeitos chamativos; usar motion apenas para estado, hover e entrada. |
| GSAP — https://gsap.com/ | Referencia de animacao profissional. | Nao adicionar GSAP; CSS resolve o nivel de motion necessario. |
| getdesign.md — https://getdesign.md/ | Referencia para documentar DESIGN.md de produto. | Criar `DESIGN.md` local como contrato visual. |
| designmd.ai — https://designmd.ai/ | Formato DESIGN.md como fonte unica para IAs. | Documentar tokens, layout, componentes e anti-padroes. |
| designmd.me — https://designmd.me/ | Geracao de design systems em markdown. | Usar como inspiracao de estrutura, nao como gerador automatico. |
| neuform.ai — https://neuform.ai/ | Referencia de templates e DESIGN.md reutilizavel. | Reforcar consistencia visual sem copiar templates. |
| ui-ux-pro-max local | Recomendacoes de dark dashboard: contraste alto, microinteracoes 150-300ms, evitar horizontal scroll. | Adotar fundo escuro, foco visivel, movimento reduzido e estados claros. |
| impeccable local | Principios de produto: tarefa primeiro, familiaridade operacional, tokens fixos. | Interface de console real, densa e legivel, sem hero marketing. |
| karpathy-guidelines local | Mudancas cirurgicas e simplicidade. | Evitar refatoracao grande e preservar contratos existentes. |

## Ideias Aproveitadas

- Sidebar persistente no desktop e painel recolhivel no mobile.
- TopBar como area de comando com navegacao principal clara.
- Cards apenas para itens, formularios, modais e paineis realmente delimitados.
- Tokens centralizados de cor, borda, sombra, espacamento e motion.
- Estados `ready`, `loading`, `error`, `empty`, `running`, `paused`, `done` com feedback visual consistente.
- Microinteracoes curtas: hover, foco, entrada discreta e progresso.
- Interface escura com acentos de ouro envelhecido, ferro, vinho e pergaminho.

## Ideias Descartadas

- Instalar bibliotecas novas de UI, animacao ou CSS.
- Efeitos de glow exagerado, shaders, particulas, orbes ou hero decorativo.
- Landing page ou tela promocional.
- Fonte fantasia para controles, labels ou mensagens.
- Gradientes roxos/azuis dominantes ou visual monocromatico.
- Cards aninhados como estrutura principal da pagina.
- Motion infinito fora de estados de carregamento/progresso.

## Riscos de Licenca e Copia

- Nenhum componente externo foi copiado.
- As fontes serviram como referencia conceitual.
- A implementacao final usa CSS e componentes proprios do projeto.
- Nao ha uso de marcas, nomes, imagens ou elementos protegidos de Game of Thrones.

## Decisao Final

A V1 final sera um console operacional de fantasia medieval sombria:

- Fundo escuro com textura CSS de pedra/ferro, sem imagens externas.
- Acentos de ouro envelhecido para foco, selecao e acoes primarias.
- Vermelho vinho para perigo, erro e tensao visual controlada.
- Pergaminho claro apenas para texto relevante, nunca como tema dominante.
- Layout denso, previsivel e responsivo.
- Console como primeira tela operacional, sem etapa intermediaria.
- Console, Downloads e Automacoes mantem os fluxos existentes.
- Acessibilidade basica: foco visivel, contraste, labels, targets clicaveis e `prefers-reduced-motion`.
