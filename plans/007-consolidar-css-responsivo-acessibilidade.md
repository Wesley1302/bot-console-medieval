# Plano 007: Consolidar CSS responsivo e acessibilidade operacional

> **Instruções ao executor**: este plano preserva o desenho atual. Não redesenhe,
> não troque CSS puro por framework e não altere textos ou fluxos sem um teste que
> demonstre a necessidade.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- src/styles src/components tests`

## Status

- **Prioridade**: P1
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: planos 001 e 004
- **Categoria**: responsividade / acessibilidade / manutenção visual
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

`src/styles/medieval-theme.css` acumula mais de 1.500 linhas físicas, regras
repetidas para `.message-list` e `.composer` e media queries que se sobrepõem.
Hoje uma mudança pequena pode corrigir mobile e quebrar desktop em outra regra
mais abaixo. Também há controles operacionais sem comportamento completo de
teclado, como modal e menus de contexto.

## Evidências atuais

```css
/* medieval-theme.css */
@media (max-width: 980px) {
  .automation-layout { grid-template-columns: 1fr; }
}

@media (min-width: 901px) {
  .automation-layout {
    grid-template-columns: minmax(360px, 462px) minmax(0, 1fr);
  }
}
```

Entre 901 px e 980 px, a segunda regra vence por estar depois, anulando a
intenção da primeira.

```jsx
// src/components/ui/Modal.jsx
if (!open) return null;
return <div className="modal-backdrop" role="dialog" aria-modal="true" ...>
```

O modal declara semântica, mas não fecha com Escape, não contém foco e não
restaura o foco anterior.

Menus de contexto usam `left/top` recebidos do ponteiro sem limitar sua posição
ao viewport. O long press abre o menu, mas o clique subsequente pode também
selecionar o canal/mensagem.

## Contratos a preservar

- Aparência medieval e tokens existentes.
- Navegação desktop e mobile atual.
- Composer fixo e utilizável em chats vazios ou longos.
- Sidebar à esquerda em desktop e drawer em mobile.
- Clique direito no desktop e pressão longa no mobile.
- Nenhuma mudança nos contratos HTTP.
- Nenhum texto funcional removido sem aprovação.

## Escopo

**Pode modificar/criar**:

- `src/styles/medieval-theme.css`
- `src/styles/layout.css`
- `src/styles/global.css`
- `src/styles/components/messages.css` (criar)
- `src/styles/components/channels.css` (criar)
- `src/styles/components/automations.css` (criar)
- `src/styles/components/feedback.css` (criar)
- `src/main.jsx` apenas para imports CSS, preservando a ordem
- `src/components/ui/Modal.jsx`
- componentes que implementam menu de contexto/long press
- `tests/frontend/**/*.test.jsx`
- `tests/e2e/responsive.spec.js`
- `plans/README.md`

**Não modificar**:

- paleta/tokens de marca, salvo contraste comprovadamente insuficiente;
- estrutura de dados, API ou regras de negócio;
- conteúdo das telas;
- stack CSS;
- layout por preferência estética.

## Matriz visual obrigatória

Capturar antes e depois:

| Viewport | Tela mínima |
|---|---|
| 390 x 844 | login, canais, chat vazio, chat cheio, automação |
| 430 x 932 | canais, chat com teclado/composer, modal |
| 768 x 1024 | console, downloads, automações |
| 900 x 768 | fronteira mobile |
| 901 x 768 | fronteira desktop |
| 980 x 768 | breakpoint conflitante |
| 981 x 768 | após breakpoint |
| 1024 x 768 | desktop compacto |
| 1440 x 1024 | desktop padrão |

Não aprovar por inspeção de um único viewport.

## Passos

### Passo 1: criar baseline visual e funcional

Adicionar Playwright somente como dependência de desenvolvimento e criar testes
de navegação com API mockada. Não usar conta Discord real.

Cenários mínimos:

1. login;
2. lista de categorias;
3. canal vazio;
4. canal com mensagens agrupadas e anexos;
5. fórum;
6. downloads vazio/com itens;
7. automação vazia/com card;
8. modal de edição;
9. menu de contexto junto às quatro bordas.

Os testes devem falhar para:

- overflow horizontal global;
- elemento essencial fora do viewport;
- composer fora do rodapé;
- modal sem botão acessível;
- menu cortado.

**Verificar**: screenshots e medidas são salvas como baseline antes de alterar
CSS.

### Passo 2: inventariar a cascata por componente

Para cada seletor repetido:

1. registrar todas as ocorrências e media queries;
2. identificar qual regra vence nos viewports da matriz;
3. mover somente regras entendidas;
4. comparar screenshot;
5. remover a origem apenas após equivalência.

Começar por mensagens/composer, depois canais, automações e feedback. Não mover
toda a folha de uma vez.

Importar os arquivos específicos após `tokens.css`/`global.css` e antes das
sobrescritas estritamente responsivas. Documentar a ordem no topo de
`src/main.jsx`.

**Verificar**: nenhuma classe usada fica sem definição (`rg` entre JSX e CSS) e
screenshots não mudam fora do componente migrado.

### Passo 3: definir breakpoints não sobrepostos

Usar fronteiras explícitas:

- mobile: até 900 px;
- desktop: a partir de 901 px;
- desktop compacto: 901–980 px, apenas se necessário.

Remover a contradição de `.automation-layout`. Em 901–980 px, escolher uma regra
com base em teste de conteúdo, não na largura isolada. Se duas colunas não
couberem com zoom de 200%, usar uma coluna nesse intervalo.

Conferir também:

- largura mínima zero em filhos de grid/flex;
- `max-width: 100%` para anexos e inputs;
- wrapping em botões com texto;
- nenhum `100vw` que inclua scrollbar;
- áreas fixas descontadas da altura útil.

**Verificar**: matriz completa sem overflow horizontal e sem conteúdo coberto.

### Passo 4: tornar menus de contexto robustos

Extrair um único componente reutilizável de menu somente depois de criar testes
para ambos os usos atuais.

Ao abrir:

- medir menu com `getBoundingClientRect`;
- limitar `x/y` ao viewport com margem de 8 px;
- focar o primeiro item;
- fechar com Escape, clique externo e seleção;
- usar setas para navegar entre itens;
- restaurar foco ao elemento disparador.

No long press:

- cancelar timer em `pointercancel`, movimento relevante, leave e up;
- marcar o gesto como consumido;
- impedir o clique de seleção imediatamente posterior;
- não bloquear scroll vertical normal no mobile.

**Verificar**: testes nas quatro bordas e teste mobile de long press sem abrir o
canal.

### Passo 5: completar o comportamento do Modal

Em `Modal.jsx`:

- guardar o elemento previamente focado;
- focar fechar ou primeiro campo ao abrir;
- fechar com Escape;
- manter Tab/Shift+Tab dentro do modal;
- restaurar foco ao fechar;
- impedir scroll do body enquanto aberto;
- usar `aria-labelledby` com ID do título, em vez de somente `aria-label`;
- aceitar clique no backdrop para fechar somente se esse já for o comportamento
  esperado pelo teste do produto.

Não adicionar biblioteca de modal.

**Verificar**: testes de teclado, foco restaurado e viewport 390 px.

### Passo 6: revisar foco, contraste e áreas de toque

Garantir:

- `:focus-visible` perceptível em botão, link, input e item de canal;
- ícones sem texto com `aria-label`;
- status não depende apenas da cor;
- alvos mobile com pelo menos 44 x 44 px quando isolados;
- texto secundário ainda legível;
- `prefers-reduced-motion` desativa rotações/transições não essenciais.

Não aumentar indiscriminadamente todos os controles. Preserve a densidade do
console.

**Verificar**: axe ou equivalente sem violações críticas e navegação completa
somente por teclado.

### Passo 7: remover regras antigas somente após equivalência

Depois que cada grupo estiver validado:

1. apagar a regra duplicada antiga;
2. executar build, testes unitários e e2e;
3. revisar `git diff --word-diff` para impedir alterações acidentais de valores;
4. repetir a matriz visual.

Não deixar duas implementações “temporariamente” no merge final.

## Critérios de conclusão

- [ ] Não há media queries contraditórias em 900/901/980/981 px.
- [ ] Não há overflow horizontal global nos viewports definidos.
- [ ] Composer permanece visível em canal vazio e canal longo.
- [ ] Modal funciona com teclado e restaura foco.
- [ ] Menus cabem no viewport e long press não aciona seleção.
- [ ] CSS duplicado de mensagens/canais/automações foi consolidado.
- [ ] Aparência atual foi preservada por comparação visual.
- [ ] `npm run check` e testes e2e passam.

## Condições de parada

Pare e peça decisão se:

- a correção exigir alterar o design aprovado;
- screenshots existentes não representarem o estado de produção;
- a separação CSS modificar mais de um domínio visual por commit;
- houver divergência entre comportamento desktop e mobile não documentada.

## Rollback

Cada domínio CSS deve estar em commit separado. Reverta apenas o commit do
domínio com regressão; não restaure a folha inteira nem descarte correções dos
planos anteriores.
