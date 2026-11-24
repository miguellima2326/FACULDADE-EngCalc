# Tasks 007
- [x] Migração 004_projects.sql (project, project_item) — aplicada no Neon
- [x] API: CRUD de projetos, itens, compartilhar/revogar (`shareToken`), `/api/shared/:token` só para logados; dono-only nas escritas (403)
- [x] Front: lista + detalhe, editar dados, abrir item (recarrega entradas), remover, diálogo "salvar no projeto", PDF do projeto (capa + índice + seções)
- [x] `?projeto=<token>` sobrevive ao login Google (callbackURL preserva a query)
- [ ] Teste no navegador: criar, salvar 2 cálculos, PDF, compartilhar com outro usuário, revogar → 404
