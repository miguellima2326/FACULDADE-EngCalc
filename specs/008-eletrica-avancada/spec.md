# Spec 008 — Elétrica: dados que o engenheiro não tem

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

| ID | Cálculo novo | Essência |
|----|--------------|----------|
| L1 | **Seção automática do cabo (BT)** | Tabelas de capacidade de corrente NBR 5410 (Tab. 36/37: Cu e Al, PVC e EPR/XLPE, métodos B1, B2, C, D, E/F) × fatores já existentes → menor seção comercial que atende **capacidade (Iz ≥ Ib)**, **queda de tensão** (R/X por seção, cos φ) e **curto-circuito**; aponta o critério determinante. |
| L2 | **Corrente de curto-circuito** | Icc3φ no secundário do trafo (`S`, `V`, `Z%`) e no fim do cabo (R+jX do cabo, comprimento, paralelo) → Icc e link para seção mínima (E4). |
| L3 | **Disjuntor / coordenação** | `Ib ≤ In ≤ Iz` e `I2 ≤ 1,45·Iz` (NBR 5410 §5.3.4) com correntes nominais comerciais. |
| L4 | **Correção do fator de potência** | `Qc = P·(tan φ1 − tan φ2)` → banco em kvar comercial; corrente do banco. |
| L5 | **Corrente de motor** | `In = P/(√3·V·η·cosφ)` (cv ou kW), corrente de partida (Ip/In), link para L1 (E5). |

Regras: tabelas em `lib/nbr5410.ts` com origem; valores incertos `[CONFIRMAR NA NORMA]`; todos com `example` e testes.
