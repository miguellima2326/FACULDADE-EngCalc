# Specs — Spec-Driven Development (SDD)

Toda evolução do EngCalc passa por uma spec **antes** de virar código.

## Fluxo

```
1. SPEC    (o quê / por quê)   → specs/NNN-nome/spec.md    → revisão + aprovação
2. PLAN    (como)              → specs/NNN-nome/plan.md    → revisão + aprovação
3. TASKS   (passos pequenos)   → specs/NNN-nome/tasks.md
4. IMPLEMENTAR                 → cada task fecha com os testes de aceitação passando
5. VALIDAR                     → testes de valores de referência + revisão do relatório
```

Regras do fluxo:
- Nenhum cálculo é criado ou alterado sem um **caso de teste com valor de referência**
  (exemplo resolvido de livro, norma ou conta independente) escrito na spec.
- Itens marcados `[CONFIRMAR NA NORMA]` precisam ser conferidos no texto da norma
  (ou com o professor) antes da implementação.
- A [constituição](constitution.md) vale para todas as specs.

## Índice

| Nº  | Spec                                                     | Status            |
|-----|----------------------------------------------------------|-------------------|
| 001 | [Correção dos cálculos existentes](001-correcao-calculos/spec.md) | ✅ aprovada · ✔ implementada (falta revisão no navegador) |
| 002 | [Acesso por convite (admin) + login Google](002-login-social/spec.md) | ✅ aprovada |
| 003 | [Nova hospedagem: back + banco](003-hospedagem/spec.md)  | ✅ aprovada · ✔ Neon conectado · falta env na Vercel + deploy |
| —   | [Backlog de funcionalidades](backlog.md)                 | ideias → viram specs 004+ |

Ordem sugerida: **003 → 001 → 002** (sem hospedagem nada vai ao ar; a 002 precisa do banco da 003).
