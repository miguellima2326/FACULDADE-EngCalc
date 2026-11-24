# Tasks 009 (+ parte civil das specs 005/006)

- [x] T1 `example` em todos os 11 cálculos civis (constituição §7); teste roda cada exemplo
- [x] T2 `units` nos campos de força/carga/momento/tensão (kN·tf·kgf; kN/m·tf/m·kgf/m; kN·m·tf·m; kPa·kgf/cm²·MPa; kN/m²·kgf/m²·tf/m²)
- [x] T3 Viga CA: campo opcional `Mdinf` (spec 006 E1) — substitui fd·L²/8 e o relatório indica
- [x] T4 `links` (spec 006): viga contínua → viga CA (apoio B e vão) e → sapata (R_B); pilar → sapata (Nk = Nd/1,4); viga CA → flecha; rede urbana → IDF (t = tc); IDF → drenagem predial
- [x] T5 C1 `idf` — equação i = K·T^a/(t+b)^c com presets SP, Curitiba, Brasília + personalizado
- [x] T6 C2 `laje` — Marcus (faixas + correção de torção), λ > 2 uma direção, h mín §13.2.4.1, ρ⁺ ≥ 0,67ρmín / ρ⁻ ≥ ρmín, s ≤ mín(2h; 20)
- [x] T7 C3 `flecha_ca` — Ecs, Mr (α = 1,5), estádio II, Branson, pqp = g + ψ2·q, αf com ξ(t), L/250
- [x] T8 C4 `ancoragem` — fbd, lb ≥ 25φ, lb,nec, l0t com α0t; bloqueia traspasse φ > 32
- [x] T9 C5 `materiais` — volume, forma, aço por taxa, cimento/areia/brita/água pelo volume absoluto
- [x] T10 Testes `test/civil-novos.test.ts` (14) com valores à mão

## Desvio da spec (registrar)
- C2 usa o **método de Marcus** (analítico, clássico no ensino brasileiro) em vez das tabelas de Bares/Czerny:
  não havia fonte confiável dos coeficientes tabelados para embutir. Relatório avisa `[CONFIRMAR]`.

## Pendências `[CONFIRMAR]`
- C1: parâmetros das equações IDF — SP (Wilken 1972: 1747,9; 0,181; 15; 0,89), Curitiba (Parigot de Souza 1959: 5950; 0,217; 26; 1,15), Brasília (Novacap: 1574,7; 0,207; 11; 0,884) — conferir nas fontes/manuais municipais.
- C2: fórmula de correção de Marcus ν = 1 − (20/3)·(k/m)·(l/l')² e divisores m = 8 / 14,22 / 24 e n = 8 / 12; comparar com Bares para λ = 1,0–2,0.
- C3: ψ2 padrão 0,3 (residencial) e αi = 0,8 + 0,2·fck/80 (agregado granito, αE = 1).
- C4: α0t por % de barras emendadas e l0t,mín = máx(0,3·α0t·lb; 15φ; 200 mm) (§9.5.2.2).
- C5: taxas de aço típicas (viga 100, pilar 120, laje 80, sapata 60 kg/m³) e massas unitárias de areia/brita (1,5 / 1,4 t/m³) são aproximadas.
