# Tasks 010

- [x] T1 `packages/core/src/mecanica.ts` com os 7 cálculos originais migrados (mesmo comportamento, diagrama do RPM embutido) — falta trocar o bloco `mecanica` do `data.ts` por `MECANICA` (integração)
- [x] T2 Convenções §7: `example` em todos; `units` em comprimento (mm/in), força (N/kN/kgf), torque (N·m/kgf·m), área (mm²/cm²), Vc (m/min, m/s)
- [x] T3 M1 `eixo` — DE-ASME elíptico (Shigley eq. 7-12), Marin (ka, kb iterativo, ke), von Mises de escoamento, diâmetro comercial
- [x] T4 M2 `parafuso` — ISO 261/898-1 (M6–M30), 8.8/10.9/12.9, Fi = 0,75/0,90·At·Sp, T = K·Fi·d, carga externa opcional
- [x] T5 M3 `engrenagem` — DIN 867 / ISO 54, diâmetros, distância entre centros, Zmín = 2/sen²α, n2 opcional
- [x] T6 `packages/core/test/mecanica.test.ts` — 12 testes

## Pendências de conferência
- Propriedades dos aços (Shigley A-20/A-21): 1020 HR 380/210, 1045 CD 630/530, 4140 Q&T 650 °C 758/655 MPa
- ISO 898-1: Sp da 8.8 = 580 MPa (d ≤ 16) e 600 MPa (d > 16); 10.9 = 830; 12.9 = 970
- Coeficientes K (Shigley Tab. 8-15): 0,30 oxidado; 0,20 zincado; 0,18 lubrificado; 0,16 cadmiado
- Arredondamento de Zmín (17,1 → 17 para 20°; 11,2 → 12 para 25°)
