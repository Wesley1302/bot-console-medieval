# V2.5 Exportações Avançadas

## Problema

A V1 exporta alvos inteiros. Investigações precisam de recorte por período, autor, termo, bot/humano e anexos.

## Escopo

Definição persistida de exportação, estimativa prévia, filtros, reexecução, manifesto de integridade, diff entre execuções e retenção configurável.

## Compatibilidade

Preservar JSON/Markdown/TXT e os quatro arquivos da V1. PDF não entra nesta etapa sem decisão própria.

## Falhas e testes

Filtros devem ser aplicados sem carregar páginas desnecessárias quando possível. Testar paginação, recortes vazios, anexos, exportação interrompida, reexecução idêntica e limites de bulk.

**Esforço:** G. **Gate:** plano 006 aprovado e benchmark de exportação concluído.
