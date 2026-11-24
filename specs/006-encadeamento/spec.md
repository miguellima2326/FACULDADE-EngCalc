# Spec 006 — Encadeamento de cálculos

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

O resultado de um cálculo oferece botões que abrem o próximo cálculo **já preenchido** (constituição §7, `links`).

| ID | De → Para | Valores levados |
|----|-----------|-----------------|
| E1 | Viga contínua → Viga CA (apoio B) | `L` = maior vão, cargas convertidas para gk/qk equivalentes p/ gerar |M_B| (ver nota) |
| E2 | Viga contínua → Sapata | reação do apoio central `R_B` como `Nk` |
| E3 | Pilar → Sapata | `Nk = Nd/1,4`, dimensões do pilar `a`, `b` |
| E4 | Corrente de curto (spec 008) → Seção mínima por curto | `Icc`, `t` |
| E5 | Motor / carga (spec 008) → Seção automática do cabo | corrente de projeto `Ib` |

Nota E1: a viga CA é biapoiada (M = fd·L²/8); o link envia a seção para dimensionar com o **momento informado**
— a viga CA ganha o campo opcional `Md,inf` (momento de cálculo informado), que, quando preenchido, substitui fd·L²/8.

## Aceitação
- [ ] Viga contínua exemplo → botão "Dimensionar apoio B" abre Viga CA com Md,inf = 1,4·|M_B|.
- [ ] Ao seguir o link, a folha rola até o cálculo aberto e mostra de onde vieram os valores ("valores vindos de: Viga contínua").
