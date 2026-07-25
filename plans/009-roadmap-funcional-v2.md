# Plano 009: Preparar e priorizar o roadmap funcional da V2

> **Instruções ao executor**: este plano produz especificações e spikes, não
> implementa as seis features. Só uma feature entra em execução depois de
> aprovação explícita de escopo, segurança e critérios de aceite.
>
> **Drift check inicial**:
> `git diff --stat 06a1660..HEAD -- PRODUCT.md README.md plans docs`

## Status

- **Prioridade**: P2
- **Esforço**: M para especificação; implementação não estimada aqui
- **Risco**: BAIXO na documentação, variável na implementação
- **Depende de**: planos 001–008
- **Categoria**: produto / arquitetura evolutiva
- **Planejado em**: commit `06a1660`, 24/07/2026

## Objetivo

Transformar as sugestões da auditoria em specs pequenas, verificáveis e
priorizadas. Evitar construir “plataforma genérica” antes de validar qual
problema operacional tem maior valor.

## Princípios

1. Preservar a V1 como baseline funcional.
2. Entregar uma feature por vez atrás de flag quando houver risco.
3. Não adicionar banco, Gateway ou multi-servidor por antecipação.
4. Definir migração e rollback antes de alterar persistência.
5. Medir uso/erro antes de otimizar.
6. Cada spec deve declarar explicitamente o que fica fora.

## Escopo

**Pode criar/modificar nesta etapa de planejamento**:

- `docs/v2/*.md`;
- `PRODUCT.md` somente para apontar ao roadmap aprovado;
- `plans/README.md` para atualizar o status deste plano;
- documentação de métricas sem conteúdo sensível.

**Não pode modificar nesta etapa**:

- código frontend ou backend;
- contratos de API;
- `.env`, configuração da Oracle/Vercel ou dados persistidos;
- dependências;
- Discord real;
- flags de produção.

Cada implementação futura exige um plano separado, autorização e testes próprios.

## Artefatos a criar

```text
docs/v2/
  README.md
  01-diagnostico-permissoes.md
  02-trilha-auditoria.md
  03-automacoes-recorrentes.md
  04-caixa-eventos-tempo-real.md
  05-exportacoes-avancadas.md
  06-workspaces-multiservidor.md
  decision-log.md
```

Cada spec deve conter:

- problema e evidência;
- usuário/fluxo;
- histórias e não objetivos;
- UX desktop/mobile;
- modelo de dados;
- endpoints/eventos;
- permissões Discord;
- segurança/privacidade;
- idempotência e falhas;
- migração/rollback;
- telemetria sem conteúdo sensível;
- testes;
- critérios de aceite;
- estimativa P/M/G/XL;
- gate “construir / rejeitar / investigar”.

## Features propostas

### 1. Diagnóstico de permissões por canal

**Problema**: erros 403 hoje são explicados depois da falha. O operador não sabe
antecipadamente onde o bot pode ler, enviar, anexar, gerenciar mensagens ou
threads.

**Nova função**:

- matriz por categoria/canal/tópico;
- badges de leitura, escrita, anexos e moderação;
- ação “testar acesso” sem enviar mensagem;
- explicação da permissão Discord faltante;
- filtro “mostrar somente bloqueados”.

**Valor**: reduz tentativas às cegas e tempo de configuração.

**Spike**:

- confirmar como calcular overwrites do guild/member/roles;
- comparar cálculo local com resposta efetiva do Discord;
- decidir cache e invalidação;
- prototipar endpoint somente leitura em um canal de QA.

**Não objetivo**: editar permissões do Discord pelo painel.

**Esforço inicial**: M. **Prioridade sugerida**: primeira feature V2.

### 2. Trilha de auditoria operacional

**Problema**: o painel executa ações destrutivas e automáticas, mas não há uma
linha do tempo consolidada de quem solicitou, qual alvo, resultado e erro.

**Nova função**:

- registrar login/logout, envio, edição, exclusão, exportação e automação;
- filtros por ação, alvo, resultado e período;
- IDs e metadados, nunca senha/token/cookie;
- retenção configurada;
- exportação da auditoria para JSON/CSV;
- correlação de uma automação com cada envio.

**Valor**: investigação de incidentes, prestação de contas e suporte.

**Spike**:

- definir schema append-only;
- comparar JSONL local com SQLite;
- medir concorrência e rotação;
- especificar política de conteúdo: preferir hash/contagem, não texto integral.

**Não objetivo**: sistema multiusuário/RBAC nesta primeira entrega.

**Esforço inicial**: M/G. **Prioridade sugerida**: segunda.

### 3. Automações recorrentes, modelos e simulação

**Problema**: a V1 executa sequência e agendamento único. Operações repetidas
precisam ser recriadas manualmente e erros só aparecem depois de ativar.

**Nova função**:

- recorrência diária/semanal com timezone explícito;
- templates reutilizáveis;
- prévia dos blocos já divididos para o limite Discord;
- “dry run” que valida alvo, menções e permissões sem enviar;
- histórico de execuções e próxima ocorrência;
- limite de frequência e janela de silêncio.

**Valor**: torna a automação reutilizável sem perder controle operacional.

**Pré-condição**: plano 003 concluído e trilha de auditoria definida.

**Spike**:

- escolher representação de recorrência limitada, sem cron arbitrário;
- definir DST/timezone;
- provar idempotência em restart;
- definir edição de série versus próxima ocorrência.

**Não objetivo**: anexos, IA ou editor de workflow genérico.

**Esforço inicial**: G. **Prioridade sugerida**: terceira.

### 4. Caixa de eventos e atualização em tempo real

**Problema**: polling de cinco segundos é suficiente para consulta, mas não
oferece presença imediata nem uma visão consolidada de menções, edições e
exclusões relevantes.

**Nova função**:

- processo Discord Gateway dedicado;
- eventos de mensagem criada/editada/apagada;
- caixa de menções ao bot e falhas operacionais;
- atualização do canal aberto sem polling agressivo;
- reconexão, sequence/resume e estado “desatualizado” visível;
- transporte servidor→browser por SSE inicialmente, se unidirecional bastar.

**Valor**: console mais confiável para acompanhamento ao vivo.

**Pré-condição**: decidir arquitetura de processo único e persistência de
offsets; não misturar esta entrega com multi-instância.

**Spike**:

- listar intents estritamente necessários;
- medir eventos por minuto;
- comparar SSE e WebSocket;
- testar reconexão/replay;
- definir fallback para polling.

**Não objetivo**: presença completa, voz ou clone do cliente Discord.

**Esforço inicial**: G/XL. **Prioridade sugerida**: quarta.

### 5. Exportações avançadas e reexecutáveis

**Problema**: exportações atuais cobrem alvos inteiros. Investigações e arquivos
operacionais frequentemente precisam de recorte por período, autor ou termo.

**Nova função**:

- filtros de data, autor, bot/humano, termo e anexos;
- estimativa antes de iniciar;
- salvar uma definição de exportação e reexecutá-la;
- hash/manifesto de integridade;
- diff entre duas execuções;
- política de retenção por definição.

**Valor**: reduz downloads excessivos e torna o acervo reproduzível.

**Pré-condição**: plano 006 concluído.

**Não objetivo**: PDF ou indexador de busca global nesta entrega.

**Esforço inicial**: G. **Prioridade sugerida**: quinta.

### 6. Workspaces multi-servidor

**Problema**: a V1 é presa a um único `DISCORD_GUILD_ID`. Se o painel passar a
operar comunidades distintas, configuração, dados e permissões precisam ser
isolados.

**Nova função**:

- selecionar guild autorizada;
- escopo de automações/exportações/auditoria por guild;
- configuração e saúde por workspace;
- isolamento de arquivos e limites;
- confirmação reforçada para ação destrutiva em outro servidor.

**Valor**: amplia o uso do produto, mas muda o modelo de segurança.

**Gate obrigatório**: só construir com demanda real por pelo menos dois
servidores. Antes disso, manter single-guild.

**Spike**:

- decidir autenticação/RBAC;
- avaliar banco e migração;
- desenhar isolamento;
- revisar rate limits agregados;
- definir onboarding seguro de guild.

**Não objetivo**: marketplace público ou OAuth amplo no mesmo release.

**Esforço inicial**: XL. **Prioridade sugerida**: condicional.

## Ordem de decisão recomendada

| Ordem | Feature | Motivo | Gate |
|---:|---|---|---|
| 1 | Diagnóstico de permissões | alto valor, predominantemente leitura | cálculo validado em QA |
| 2 | Trilha de auditoria | base para operações futuras | política de conteúdo/retenção |
| 3 | Automações recorrentes | aproveita domínio existente | idempotência/restart aprovados |
| 4 | Eventos em tempo real | remove polling e cria inbox | intents, reconnect e fallback |
| 5 | Exportações avançadas | amplia acervo após hardening | plano 006 aprovado |
| 6 | Multi-servidor | maior mudança arquitetural | demanda real e modelo de acesso |

## Passos

### Passo 1: registrar baseline e métricas

Antes das specs, documentar:

- tempo médio de carregamento de canais/mensagens;
- frequência de 401/403/429/5xx;
- duração e tamanho de exportações;
- automações criadas/concluídas/falhas;
- uso desktop/mobile;
- permissões mais frequentemente ausentes.

Não registrar conteúdo de mensagem, token, cookie ou senha.

### Passo 2: escrever specs 01 e 02

São as features de menor acoplamento e maior suporte às demais. Validar cada uma
com o operador antes de escrever código.

**Verificar**: todos os campos do template preenchidos; nenhuma decisão crítica
marcada apenas como “a definir” sem responsável.

### Passo 3: executar spikes de risco

Spikes devem:

- viver em branch descartável;
- usar dados sintéticos/canal QA;
- ter prazo máximo;
- produzir decisão, benchmark e descarte;
- nunca ir para produção.

### Passo 4: fatiar a feature aprovada

Para cada feature:

1. contrato/modelo;
2. backend atrás de flag;
3. UI somente leitura;
4. escrita controlada;
5. telemetria;
6. rollout parcial;
7. remoção da flag após estabilidade.

Cada fatia deve caber em um PR revisável e reversível.

### Passo 5: manter decision log

Para cada decisão, registrar:

- data;
- contexto;
- opções;
- decisão;
- consequência;
- condição para reavaliar.

Isso evita reabrir debates e impede que um executor barato invente arquitetura.

## Critérios de conclusão deste plano

- [ ] Seis specs existem e seguem o template.
- [ ] As quatro primeiras têm problema, UX, segurança e aceite completos.
- [ ] Ordem e gates foram aprovados pelo operador.
- [ ] Nenhuma feature foi implementada por este plano.
- [ ] Não há promessa de banco/Gateway/multi-servidor sem gate.
- [ ] `docs/v2/decision-log.md` registra decisões reais.
- [ ] Cada implementação futura possui plano próprio antes do código.

## Condições de parada

Pare e peça decisão se:

- não houver evidência de uso para uma feature;
- uma spec exigir mudança de autenticação/privacidade;
- houver necessidade de conteúdo sensível em logs;
- o spike implicar ação real no Discord;
- tentarem agrupar duas features no mesmo release.
