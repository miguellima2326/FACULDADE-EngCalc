# Tasks 001

- [x] T0  Infra de testes: `npm test` (node:test + tsx) — 40 testes
- [x] T1  A (viga contínua) — A1–A5
- [x] T2  E (drenagem) — `lib/hidraulica.ts`; `tubos` virou **predial NBR 10844**; urbana corrigida em `rede_urbana`
- [x] T3  C (sapata) — C1–C8 (Nk/Mk de serviço, balanços iguais, h rígido calculado, biela no contorno C)
- [x] T4  B (viga CA) — B1–B7 (Kmd 0,251, βx/z, Tab. 17.3, estribos)
- [x] T5  D (pilar) — D1–D8 (2 direções, flexo-compressão por equilíbrio, curvatura NBR, λ ≤ 90)
- [x] T6  H1 campos vazios (front + `normalizeValues`) · H2 parcial (ainda `@ts-nocheck` em data/civil/eletrica)
- [x] T7  `lib/nbr5410.ts` (Tab. 40/41/42/44/45) → F1–F4 · ⚠ itens `[CONFIRMAR NA NORMA]` abaixo
- [x] T8  G1, G2
- [ ] T9  Revisão no navegador + deploy de preview

## Pendências de conferência na norma
- NBR 5410 Tab. 41: pontos 0,5/0,7 K·m/W e valor de 3,0 K·m/W (direto enterrado: 0,90 IEC × 0,96?)
- Agrupamento enterrado (IEC B.52.18/19) e numeração Tab. 44/45 na NBR 5410
- Profundidade de referência em MT (IEC 60502-2: 0,8 m × NBR 14039)
- Item da NBR 5410 que traz os valores de k do curto-circuito
- NBR 6122: acréscimo de σmáx permitido para combinações com vento (adotado σmáx ≤ σadm)
