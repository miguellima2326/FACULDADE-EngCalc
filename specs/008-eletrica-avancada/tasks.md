# Tasks 008

- [x] T1 `example` em `cabo_mt`, `cabo_bt`, `curto_circuito` (constituição §7)
- [x] T2 Tabelas em `lib/nbr5410.ts`: Iz Cu PVC/XLPE × 2/3 carregados × métodos A1, A2, B1, B2, C, D (1,5–300 mm²); R20 (IEC 60228) Cu/Al com correção de temperatura; k adiabático (Tab. 30)
- [x] T3 L1 `secao_cabo` — capacidade + queda de tensão (R/X) + curto; seção por critério e determinante; link → `disjuntor`
- [x] T4 L2 `icc` — trafo (Z%, X/R) + cabo (R20, X 0,08 Ω/km, paralelo); link → `curto_circuito`
- [x] T5 L3 `disjuntor` — Ib ≤ In ≤ Iz, I2 ≤ 1,45·Iz (60898: 1,45·In · 60947-2: 1,30·In), faixa magnética por curva
- [x] T6 L4 `fator_potencia` — Qc, banco comercial, FP resultante (sobrecompensação), redução de corrente
- [x] T7 L5 `motor` — In, Ip, Ib = 1,25·In; link → `secao_cabo`
- [x] T8 Testes `test/eletrica-avancada.test.ts` (11 casos, valores à mão) + todos os `example` rodam

## Pendências [CONFIRMAR NA NORMA]
- Iz das Tab. 36/37 (transcritas da IEC 60364-5-52 B.52.2–B.52.5); métodos E/F não incluídos
- Alumínio: Iz aproximado como 0,78 × cobre (substituir pela coluna Al da norma)
- Reatância 0,08 Ω/km típica (catálogo do fabricante dá o valor real)
- Icc: rede a montante infinita e c = 1 (IEC 60909 simplificada); X/R padrão 5
- Motor: Ib = 1,25·In para circuito terminal de motor (NBR 5410 §6.5.1)
