# Spec 007 — Projetos (obras)

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

## Objetivo
Agrupar cálculos de uma obra, salvos no banco, reabrir depois e gerar a memória completa em PDF.

| ID | Requisito |
|----|-----------|
| J1 | Criar/renomear/excluir projeto (nome, descrição, cliente/obra). |
| J2 | Em qualquer resultado: **"Salvar no projeto"** (escolhe o projeto) — guarda área, cálculo, entradas, relatório e data. |
| J3 | Página do projeto lista os itens; abrir um item recarrega o cálculo com as entradas salvas; remover item. |
| J4 | **PDF do projeto**: capa + índice + uma seção por item (spec 004). |
| J5 | **Compartilhar**: link de leitura (`?projeto=<token>`) visível para qualquer usuário **logado**; o dono pode revogar. |
| J6 | Só o dono edita. Admin não vê projetos alheios (privacidade). |

## Dados
`project(id, userId, name, description, shareToken, createdAt, updatedAt)`
`project_item(id, projectId, areaKey, calcId, calcName, vals jsonb, report text, createdAt)`

## Aceitação
- [ ] Criar "Galpão X", salvar viga contínua e sapata → página lista 2 itens → PDF com capa, índice e 2 seções.
- [ ] Outro usuário logado com o link vê o projeto em modo leitura; após revogar → 404.
- [ ] API: usuário B não consegue editar projeto de A (403).
