# Patch Report

## Data/Hora

2026-06-24, America/Sao_Paulo.

## Objetivo

Aplicar os ajustes finais de navegacao, identidade do bot e mencoes em automacoes no mesmo projeto `bot-console-medieval`.

## Arquivos Alterados

- Backend: status Discord, entidades mencionaveis, envio de mensagens e execucao de automacoes.
- Frontend: shell, navegacao, sidebar, arvore de canais e formulario de automacoes.
- Novos modulos: `src/api/mentions.api.js`, `src/components/mentions/MentionPicker.jsx` e `src/utils/insertAtCursor.js`.
- Estilos: identidade do bot, navegacao mobile e seletor responsivo de mencoes.
- Documentacao do produto e deste patch.

## Features Implementadas

- Canais passa a abrir como tela inicial; no mobile o drawer e o item Canais iniciam ativos.
- Seletor de mencoes para usuarios, cargos, `@here` e `@everyone`.
- Insercao da mencao na posicao atual do cursor, em Sequencia e Agendada.
- Automacoes enviam `allowed_mentions` explicito para usuarios, cargos e everyone/here.
- `/api/mentions` continua protegido e agora retorna grupos estruturados, mantendo `results` por compatibilidade.
- `/api/status` inclui `avatarUrl` e `displayName` sem remover campos existentes.
- Sidebar mostra avatar circular e nome real do bot em azul.
- Blocos estaticos BCM/Servidor Discord/COROA DE VIDRO/Comunidade removidos.
- Opcao visual Sair removida no desktop e mobile; `POST /api/auth/logout` permanece disponivel.

## Deteccao De Mencao Ao Bot

Adiada: deteccao confiavel de mencoes ao bot requer Discord Gateway/eventos ou polling dedicado. Para nao arriscar o deploy, ficou fora deste patch.

## Testes Executados

- `npm run build`: aprovado.
- `node --check server.mjs`: aprovado.
- `node --check` em 21 modulos `.mjs`: aprovado.
- Teste unitario de insercao no cursor: aprovado.
- API local real: health 200, status sem sessao 401, login 200, status autenticado 200.
- `/api/mentions`: 200, usuarios/cargos/especiais retornados, zero warnings no ambiente testado.
- UI via Chrome CDP em 390px e 1440px: zero overflow, erro de console, excecao ou falha de rede.
- Identidade real do bot e ausencia de Sair validadas em desktop/mobile.
- MentionPicker validado em Sequencia e Agendada.
- Automacao real de sequencia com mencao segura ao proprio bot: aprovada.
- Automacao real agendada com mencao segura ao proprio bot: aprovada.
- `@here` e `@everyone` validados na UI; nao enviados ao Discord para evitar notificacao em massa.

## Dados De QA

- Duas mensagens `[PATCH QA]` criadas no canal `teste-bot`.
- Duas automacoes criadas.
- Mensagens e automacoes removidas ao final: limpeza aprovada.

## Bugs Encontrados E Corrigidos

- A resposta antiga de mencoes nao separava grupos nem continha metadados de avatar/cor.
- Automacoes nao declaravam `allowed_mentions`, deixando o comportamento dependente do padrao do Discord.
- A navegacao inicial mobile abria no Console em vez de Canais.
- Identidade visual usava textos estaticos em vez dos dados reais do bot.

## Riscos Restantes

- Usuarios podem nao ser listados se o bot nao tiver permissao/intent; cargos e especiais continuam disponiveis com warning amigavel.
- O transporte Vercel -> Oracle continua HTTP publico; login pela URL Vercel nao deve ser validado antes de TLS no backend.
- Deteccao de mencoes recebidas pelo bot permanece pendente por exigir arquitetura de eventos.
- `npm ci` na VPS reportou tres advisories; nenhum `npm audit fix` foi executado, conforme a restricao do projeto.

## Deploy Vercel

- Commit funcional: `352305c`.
- Backend atualizado na release Oracle `20260624003841`.
- PM2: online.
- Health Oracle local e publico: 200.
- Login/status/mentions internos na Oracle: 200.
- Projeto Vercel confirmado por `projectId` como `bot-console-medieval` antes do deploy.
- Deploy de producao: `https://bot-console-medieval-g7gt2e0fy-wesleys-projects-1e089870.vercel.app`.
- Alias principal preservado: `https://bot-console-medieval.vercel.app/`.
- Pagina, JS, CSS e `/api/health`: 200.
- `/api/status` sem sessao: 401, conforme esperado.
- Login via Vercel nao executado: o rewrite ainda usa HTTP publico para a Oracle e nao e seguro transmitir a senha nesse trecho.

## Status Final

**PATCH APROVADO E PUBLICADO.**

A publicacao tecnica do patch foi validada. A V1 continua aguardando TLS no backend para o teste autenticado ponta a ponta pela Vercel.
