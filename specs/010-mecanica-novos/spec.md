# Spec 010 — Mecânica: novos cálculos

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

| ID | Cálculo | Essência |
|----|---------|----------|
| M1 | **Dimensionamento de eixo** | Flexão + torção, von Mises / ASME: `d = [ (32·n/π)·√((Kf·M/Se)² + ¾(T/Sy)²) ]^(1/3)` com materiais comuns (SAE 1020/1045/4140). |
| M2 | **Aperto de parafusos** | Pré-carga `Fi = 0,75·At·Sp` (classes 8.8/10.9/12.9, roscas métricas M6–M30 com At tabelado) e torque `T = K·Fi·d`. |
| M3 | **Engrenagens cilíndricas** | Módulo, Z1/Z2 → diâmetros primitivos, relação, distância entre centros, verificação de interferência (Zmín). |

Os 7 cálculos atuais migram para `mecanica.ts` (com `example`, `units` e diagrama do RPM).
