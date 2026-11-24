# Spec 009 — Civil: novos cálculos e dados de chuva

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

| ID | Cálculo | Essência |
|----|---------|----------|
| C1 | **Intensidade de chuva (IDF)** | `i = K·T^a/(t+b)^c` com parâmetros por cidade (presets de equações publicadas, marcados `[CONFIRMAR]`) ou digitados; `t` pode vir do `tc` (link da rede urbana). |
| C2 | **Laje maciça** | Momentos por coeficientes (tabelas de Bares/Czerny para os casos de apoio usuais), armadura por metro e espaçamento, ρmín de laje. |
| C3 | **Flecha de viga CA (ELS)** | Inércia equivalente de Branson, flecha imediata + diferida (αf) × limite L/250. |
| C4 | **Ancoragem e emenda** | `fbd = η1·η2·η3·fctd`, `lb = φ/4·fyd/fbd`, lb,nec com ganchos/As,ef. |
| C5 | **Consumo de materiais** | Volume de concreto, área de forma, taxa/peso de aço (kg/m³), por elemento. |

Também: `example` + `units` (kN↔tf↔kgf) + `links` (E1, E2, E3 da spec 006) nos cálculos civis existentes; campo `Md,inf` na viga CA.
