# Plano 008: Consolidar limites dos módulos e remover dívida comprovada

> **Instruções ao executor**: só execute depois dos planos 003–007. Este não é
> um convite para “limpar o projeto”. Cada remoção exige prova de que o símbolo
> não é usado e cada abstração exige duas utilizações reais.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- src server/src package.json README.md`

## Status

- **Prioridade**: P2
- **Esforço**: M
- **Risco**: MÉDIO
- **Depende de**: planos 003, 004, 005, 006 e 007
- **Categoria**: arquitetura / manutenção
- **Planejado em**: commit `06a1660`, 24/07/2026

## Por que isso importa

Há duplicação concreta de ownership:

- `ChannelTree` e `AutomationForm` chamam `getChannels()` separadamente;
- `/api/mentions` possui wrappers em `channels.api.js` e `mentions.api.js`;
- menus de contexto têm implementação embutida enquanto
  `ChannelContextMenu.jsx` retorna `null`;
- `DashboardHome.jsx` e estilos de dashboard permanecem após a remoção da tela.

A meta é reduzir caminhos concorrentes sem criar camadas genéricas.

## Contratos a preservar

- A tela inicial continua sendo canais/console conforme comportamento aprovado.
- Selecionar alvo na sidebar durante automações não troca a tela.
- Mobile mantém seletor de alvo próprio quando a sidebar não é persistente.
- APIs e payloads não mudam.
- Imports públicos de componentes realmente usados continuam.
- Nenhum serviço grande é quebrado em arquivos apenas para diminuir contagem de
  linhas.

## Escopo

**Pode modificar/criar**:

- `src/components/layout/AppShell.jsx`
- `src/components/channels/ChannelTree.jsx`
- `src/components/automations/AutomationForm.jsx`
- `src/components/automations/AutomationPanel.jsx`
- `src/api/channels.api.js`
- `src/api/mentions.api.js`
- `src/hooks/useChannelTree.js` (criar se houver dois consumidores)
- componentes/estilos comprovadamente mortos
- serviços criados pelos planos 003, 005 e 006 para ajustar exports/imports
- testes e documentação afetados
- `plans/README.md`

**Não modificar**:

- regras Discord;
- endpoints;
- estado para Redux/Zustand/Context global;
- nomes visíveis;
- arquitetura para “preparar” features ainda não escolhidas;
- arquivos adjacentes sem evidência.

## Passos

### Passo 1: construir inventário de uso

Executar:

```powershell
rg -n "DashboardHome|ChannelContextMenu|searchMentions|listMentions|getChannels" src
rg -n "dashboard-|dashboard__" src
rg -n "^export |^export const" server/src src
```

Classificar cada candidato:

- usado em runtime;
- usado apenas em teste;
- export público intencional;
- morto com evidência;
- incerto.

Não remover itens “incertos”.

**Verificar**: anexar a tabela ao PR com caminho, referências e decisão.

### Passo 2: centralizar o snapshot da árvore no AppShell

Criar `useChannelTree` somente porque há dois consumidores reais:

```text
useChannelTree
  tree
  status
  error
  refresh()
```

Responsabilidades:

- uma chamada inicial a `getChannels`;
- abortar/ignorar resposta obsoleta;
- expor o mesmo objeto para sidebar e automações;
- permitir retry explícito;
- não conter seleção, busca ou categorias abertas.

`AppShell` deve:

- possuir o hook;
- derivar `activeThreads`;
- passar snapshot para `ChannelTree`;
- passar opções/árvore para `AutomationPanel`;
- manter `selectedChannel` como fonte única do alvo desktop.

`ChannelTree` continua responsável por:

- filtro visual;
- categorias abertas;
- menu de exportação;
- seleção.

`AutomationForm` continua responsável por:

- modo desktop/mobile;
- seleção mobile;
- validação do formulário.

**Verificar**:

- carregar app faz uma única request `/api/channels`;
- abrir automações não repete request sem refresh;
- refresh atualiza os dois consumidores;
- seleção na automação desktop não navega para chat;
- mobile preserva o select.

### Passo 3: escolher um único módulo para menções

Manter `src/api/mentions.api.js` como proprietário de `/api/mentions`.

Processo:

1. migrar todos os imports para `listMentions`;
2. executar testes;
3. remover `searchMentions` de `channels.api.js`;
4. manter `channelsApi` apenas com canais/fóruns;
5. não criar barrel file.

**Verificar**: `rg -n "searchMentions" src` retorna vazio e menções continuam
filtrando usuários/cargos.

### Passo 4: remover código morto comprovado

Candidatos atuais:

- `src/components/dashboard/DashboardHome.jsx`;
- estilos `.dashboard-*` sem consumidor;
- `src/components/channels/ChannelContextMenu.jsx` se o plano 007 tiver criado
  outro componente real.

Para cada remoção:

1. confirmar zero imports/referências;
2. remover arquivo;
3. remover somente CSS exclusivo;
4. build/testar;
5. procurar novamente o nome.

Não remover rotas backend placeholders ou helpers por intuição.

**Verificar**: build passa e busca não encontra classe/import órfão.

### Passo 5: consolidar exports dos novos serviços

Após os planos 003, 005 e 006:

- cada serviço tem uma instância singleton exportada para runtime;
- factories existem apenas para teste/injeção;
- helpers puros usados em um arquivo ficam privados;
- constantes de domínio compartilhadas têm um proprietário;
- rotas importam o serviço, não funções internas dispersas.

Não criar `BaseService`, service locator ou container de DI.

**Verificar**: grafo de imports não possui ciclo e testes de serviço usam
factories sem monkey patch global.

### Passo 6: alinhar documentação ao comportamento real

Revisar:

- `README.md`;
- `PRODUCT.md`;
- `DESIGN.md`/`design.md`;
- relatórios de deploy/QA;
- comentários `TODO`.

Corrigir apenas fatos obsoletos, por exemplo tela já removida, limite já
alterado ou status de deploy antigo. Não reescrever relatórios históricos; marque
o que era válido na data.

**Verificar**: documentação principal não promete dashboard ou recurso ausente.

### Passo 7: revisão final de dependências

Usar imports reais e `npm ls`, sem ferramenta automática destrutiva.

- remover dependência somente se `rg`, build e testes provarem ausência;
- manter dependências de CLI/build nas `devDependencies`;
- não atualizar versões junto com esta refatoração;
- não executar `npm audit fix`.

**Verificar**: lockfile muda apenas se uma dependência comprovadamente morta for
removida.

## Divisão recomendada de commits

1. `refactor: share discord channel tree snapshot`
2. `refactor: consolidate mentions api client`
3. `chore: remove verified dead frontend code`
4. `docs: align v1 documentation after refactor`

Não juntar todos em um commit.

## Critérios de conclusão

- [ ] Uma única request inicial fornece canais ao console e automações.
- [ ] Existe um único client frontend para `/api/mentions`.
- [ ] Código morto listado foi removido com prova.
- [ ] Nenhuma abstração genérica foi criada.
- [ ] Não há ciclos de import.
- [ ] Build, check, testes e smoke visual passam.
- [ ] Contratos/API e visual não mudaram.

## Condições de parada

Pare e peça decisão se:

- um candidato “morto” aparece em integração externa ou documentação de uso;
- compartilhar a árvore exigir store global;
- a alteração tocar contratos de API;
- houver conflito com mudanças paralelas dos planos 003–007;
- o diff exceder os módulos autorizados sem causa direta.

## Rollback

Reverter por commit. A centralização da árvore deve poder ser revertida sem
restaurar código morto ou duplicação de menções.
