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
| 001 | [Correção dos cálculos existentes](001-correcao-calculos/spec.md) | ✅ em produção (2026-11-23) |
| 002 | [Acesso por convite (admin) + login Google](002-login-social/spec.md) | ✔ implementada · falta deploy |
| 003 | [Nova hospedagem: back + banco](003-hospedagem/spec.md)  | ✅ em produção (2026-11-23) · falta remover render.yaml |
| 004 | [Exportar memória em PDF](004-exportar-pdf/spec.md) | ✅ aprovada |
| 005 | [Experiência na folha de cálculo](005-ux-folha/spec.md) | ✅ aprovada |
| 006 | [Encadeamento de cálculos](006-encadeamento/spec.md) | ✅ aprovada |
| 007 | [Projetos (obras)](007-projetos/spec.md) | ✅ aprovada |
| 008 | [Elétrica: seção automática, Icc, disjuntor, FP, motor](008-eletrica-avancada/spec.md) | ✅ aprovada |
| 009 | [Civil: IDF, laje, flecha, ancoragem, materiais](009-civil-novos/spec.md) | ✅ aprovada |
| 010 | [Mecânica: eixo, parafusos, engrenagens](010-mecanica-novos/spec.md) | ✅ aprovada |
| 011 | [Administração: uso e auditoria](011-admin-uso/spec.md) | ✅ aprovada |
| —   | [Backlog de funcionalidades](backlog.md)                 | ideias restantes |

Ordem sugerida: **003 → 001 → 002** (sem hospedagem nada vai ao ar; a 002 precisa do banco da 003).
