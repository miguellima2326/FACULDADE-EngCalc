# Backlog de funcionalidades (candidatas a specs 002+)

Priorizadas pelo critério "responder o que o engenheiro não tem" (constituição §3).
⭐ = maior valor para a apresentação.

## Elétrica
- **F-E1 ⭐ Seção automática pela NBR 5410** — embutir Tab. 36/37 (Iz por método A1…F, Cu/Al, PVC/XLPE):
  o usuário informa a carga e o método de instalação, o sistema devolve a seção comercial
  que atende **ao mesmo tempo** a capacidade de corrente, a queda de tensão e o curto-circuito
  (os três critérios atuais viram um só relatório com o "fator determinante").
- **F-E2 ⭐ Corrente de curto-circuito** — o engenheiro raramente tem a Icc: calcular no secundário
  do transformador (`Icc = In / Z%`) e no fim do cabo (soma de impedâncias R+jX); alimenta o cálculo de seção por Icc.
- **F-E3 Queda de tensão por R/X** — tabela de resistência e reatância por seção (sem depender de K do fabricante), com cos φ.
- **F-E4 Disjuntor / coordenação** — `Ib ≤ In ≤ Iz` e `I2 ≤ 1,45·Iz` (NBR 5410 §5.3.4).
- **F-E5 Correção do fator de potência** — kvar do banco de capacitores: `Qc = P·(tan φ1 − tan φ2)`.
- **F-E6 Motor** — corrente nominal a partir de cv/kW, η e cos φ; corrente de partida.
- **F-E7 Condutor de proteção (PE) e eletroduto** — seção do PE (Tab. 58) e taxa de ocupação do eletroduto (40 %).

## Civil
- **F-C1 ⭐ Curva IDF** — intensidade de chuva a partir de `i = K·TR^a/(t+b)^c` (parâmetros por cidade) usando o `tc` já calculado.
- **F-C2 ⭐ Encadeamento viga contínua → viga CA** — botão "dimensionar esta seção" que leva MB e M+ para o cálculo de armadura (hoje só sugerido em texto).
- **F-C3 Flecha de viga CA (ELS)** — inércia equivalente de Branson + fluência (αf) → comparar com L/250.
- **F-C4 Laje maciça** — momentos por tabelas de Bares/Czerny e armadura por metro.
- **F-C5 Calhas e condutores prediais (NBR 10844)** — o cálculo que a norma realmente cobre.
- **F-C6 Ancoragem e emenda de barras** — `lb = φ/4 · fyd/fbd`.
- **F-C7 Consumo de materiais / traço de concreto** — volume, cimento, areia, brita, aço (kg).
- **F-C8 Carga em pilares por área de influência** — gera o Nk que alimenta pilar e sapata.

## Mecânica
- **F-M1 Dimensionamento de eixo** (torção + flexão, critério de von Mises / ASME).
- **F-M2 Parafusos** — torque de aperto e força de pré-carga (classe 8.8, 10.9).
- **F-M3 Engrenagens** — relação, módulo, diâmetros primitivos.
- **F-M4 Ajustes ISO 286** — tolerâncias H7/g6 etc. (tabela).

## Plataforma
- **F-P1 ⭐ Exportar memória de cálculo em PDF** — capa, dados de entrada, fórmulas, resultados, norma e aviso legal (o produto que o engenheiro entrega).
- **F-P2 Fórmulas renderizadas** (KaTeX) com os valores substituídos passo a passo.
- **F-P3 Projetos** — agrupar vários cálculos de uma obra e salvar/compartilhar via link.
- **F-P4 Exemplos pré-carregados** — botão "carregar exemplo" em cada cálculo (usa os casos dos testes).
- **F-P5 Conversor de unidades embutido** no campo (kgf ↔ kN, tf/m ↔ kN/m).
