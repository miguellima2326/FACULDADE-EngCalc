# Spec 011 — Administração: uso e auditoria

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

| ID | Requisito |
|----|-----------|
| A1 | **Painel de uso**: total de cálculos (7/30 dias), por usuário e ranking dos cálculos mais usados (a partir de `calc_history`). |
| A2 | **Registro de atividades**: cadastro, mudança de papel, desativação/reativação e remoção de usuários — quem fez, quando, alvo. Tabela `audit_log`. |
| A3 | Só admin acessa (`/api/admin/*` com 403 para usuário comum). |

## Aceitação
- [ ] Admin cadastra e desativa um usuário → 2 linhas no registro com o e-mail do admin.
- [ ] Painel mostra o cálculo mais usado na última semana.
