# V2.2 Trilha De Auditoria

## Problema

Envio, edição, exclusão, exportação e automação são ações operacionais sem uma linha do tempo consolidada.

## Escopo

Registrar login/logout, ação, operador, alvo, resultado, erro seguro, jobId e correlação de automação. Armazenar IDs, contagens e hashes quando possível; não guardar conteúdo integral por padrão.

## Modelo inicial

JSONL append-only com `id`, `createdAt`, `action`, `targetType`, `targetId`, `requestId`, `status`, `durationMs`, `errorCode` e metadados mínimos. Definir rotação e retenção antes da implementação.

## Segurança

Nunca persistir senha, token, cookie, Authorization, conteúdo de mensagem ou arquivo. Proteger leitura com autenticação e limitar exportação da trilha.

## Testes e aceite

Testar escrita concorrente, restart, rotação, retenção, erro de disco e consulta filtrada. Uma ação deve gerar no máximo um registro final correlacionável.

**Esforço:** M/G. **Gate:** aprovar política de conteúdo e retenção.
