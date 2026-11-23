# Spec 001 — Correção dos cálculos existentes

**Status:** ✅ aprovada (2026-11-23) · **Origem:** auditoria de `packages/core/src/data.ts` (2026-11-23)

## Contexto
A auditoria encontrou erros que geram resultados **errados** (não só imprecisos) em
5 dos 15 cálculos. Esta spec define o comportamento correto e os testes de aceitação.
Funcionalidades novas ficam no [backlog](../backlog.md).

Legenda de severidade:
🔴 resultado errado / inseguro · 🟠 critério normativo errado ou faltando · 🟡 melhoria/aproximação

---

## A. Civil — Viga contínua 2 vãos (`deflexao`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| A1 | 🔴 | `MB` usa L² no lugar de L³ (dimensionalmente errado) | `MB = −(q₁L₁³ + q₂L₂³) / (8(L₁+L₂))` |
| A2 | 🔴 | Reação do vão 1 com sinal invertido | `RA = q₁L₁/2 + MB/L₁` ; `RB₁ = q₁L₁ − RA` |
| A3 | 🔴 | `M_max+` do vão 2 ignora o momento MB | `M_max2 = RC²/(2q₂)` (medido a partir de C) |
| A4 | 🔴 | Flecha soma o efeito de MB em vez de subtrair | flecha no vão com `\|MB\|` reduzindo; preferir máximo exato por varredura de x |
| A5 | 🟡 | Comentário diz "pórtico simples" | corrigir descrição |

**Aceitação**
- `L1=L2=6, q1=q2=10, EI=45000` → `MB = −45,00`, `RA = RC = 22,50`, `RB = 75,00`, `M+ = 25,31` (ambos os vãos), flecha máx ≈ `1,56 mm` (qL⁴/185EI).
- Hoje o sistema devolve `MB = −7,50` → teste deve falhar antes da correção.

## B. Civil — Viga CA (`concreto`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| B1 | 🟠 | Limite `Kmd = 0,295` corresponde a x/d≈0,63 — NBR 6118 limita a ductilidade em x/d ≤ 0,45 (fck≤50) e ≤ 0,35 (50<fck≤90) | `Kmd,lim = 0,68βx − 0,272βx²` → **0,251** e **0,205** |
| B2 | 🟠 | Braço de alavanca fixo `z = 0,9d` | `βx = (0,68 − √(0,4624 − 1,088·Kmd)) / 0,544` ; `z = d(1 − 0,4βx)` ; `As = Md/(z·fyd)` |
| B3 | 🟠 | `As,min` com ρ fixo e sobre `bw·d` | `As,min = ρmin·bw·h`, `ρmin = max(0,035·fcd/fyd ; 0,15%)` (Tab. 17.3) |
| B4 | 🟠 | Vrd2 verificado com cortante reduzido a "d" do apoio | Vrd2 verificado com `Vsd` **no apoio** (`fd·L/2`) |
| B5 | 🟠 | Não calcula estribos (o engenheiro precisa disso) | Modelo I: `Vc = 0,6·fctd·bw·d`, `Vsw = Vsd − Vc`, `Asw/s = Vsw/(0,9·d·fywd)`, `Asw,min/s = 0,2·fct,m/fywk·bw` → sugerir φ e espaçamento (s ≤ 0,6d ≤ 30 cm) |
| B6 | 🟡 | `fyd` limitado a 435 também para CA-60 | permitir 522 MPa (CA-60) na flexão; 435 só para estribos (fywd) |
| B7 | 🟡 | Fórmula exibida "γf·(1,4·Mgk + 1,4·Mqk)" duplica γ | `Md = 1,4·Mgk + 1,4·Mqk` |

**Aceitação** (L=6, bw=25, h=60, cob=3, fck=25, fyk=500, gk=20, qk=15)
- `Md = 220,5 kN·m`, `d = 54,5 cm`, `Kmd = 0,166`, `βx = 0,275`, `As = 10,45 cm²`, `As,min = 2,25 cm²`
- `Vsd,apoio = 147,0 kN`, `Vc = 104,8 kN`, `Asw/s calc = 1,98 cm²/m` < `Asw,min/s = 2,56 cm²/m` → adota mínimo.
- `Kmd > 0,251` → erro "seção insuficiente / armadura dupla".

## C. Civil — Sapata isolada (`fundacao`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| C1 | 🔴 | Se a sapata não é rígida, o código **diminui** o lado L (sapata fica menor que a área necessária) | Manter L pela área; calcular **h mínimo** para ser rígida: `h ≥ (L − ap)/3` (NBR 6118 §22.6.1) e avisar/adotar |
| C2 | 🔴 | Perímetro crítico `u1` com 8πd (dobro) | `u = 2(a+b) + 4π·d` (contorno a 2d) |
| C3 | 🔴 | Pressão triangular (e > L/6) com fator 4 em vez de 2 | `σmax = 2N / (3·B·(L/2 − e))` |
| C4 | 🟠 | `τRd1` com fórmula inventada | Sapata rígida: verificar só a **diagonal comprimida** no contorno C: `τsd = Fsd/(u0·d) ≤ τRd2 = 0,27·αv2·fcd` (§22.6.2.2 / §19.5.3.1) |
| C5 | 🟠 | Mistura carga de cálculo (Nd) com tensão admissível do solo (serviço) | Entrada `Nk` (serviço) para o solo; `Nd = 1,4·Nk` para concreto/aço |
| C6 | 🟡 | Sapata sempre quadrada | Pilar retangular: balanços iguais `A − B = a − b` |
| C7 | 🟡 | Peso próprio entra na área mas não em σ | usar o mesmo N total nos dois |
| C8 | 🟡 | Sugestão de barras sem espaçamento | informar `φ c/ s` (10 cm ≤ s ≤ 20 cm) |
| C9 | 🟠 | Limite de excentricidade e/L ≤ 1/3 | `[CONFIRMAR NA NORMA]` NBR 6122: área comprimida mínima (2/3 da base) |

**Aceitação**
- `a=b=40 cm, d=50 cm` → `u = 7,88 m` (hoje: 14,17 m).
- Excentricidade e > L/6 com N=800, L=B=2, e=0,4 → `σmax = 2·800/(3·2·0,6) = 444,4 kPa`.

## D. Civil — Pilar CA (`resistencia`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| D1 | 🔴 | **Armadura ignora o momento** (só compressão centrada) | Flexo-compressão normal: equilíbrio da seção retangular com armadura simétrica (iteração de x / domínios) |
| D2 | 🔴 | λ calculado só na direção h (a mais rígida) | calcular λx e λy; usar a direção crítica |
| D3 | 🟠 | e1,min = máx(h/30; 2 cm) (norma antiga) | `M1d,min = Nd·(0,015 + 0,03h)` (§11.3.3.4.3) |
| D4 | 🟠 | Curvatura `(εyd+εcd)/0,9h` | `1/r = 0,005 / (h(ν+0,5)) ≤ 0,005/h`, `ν = Nd/(Ac·fcd)` (§15.8.3.3.2) |
| D5 | 🟠 | Método da curvatura aplicado até λ=200 | válido só para λ ≤ 90; 90<λ≤140 exige fluência; λ>140 → bloquear ("método geral") |
| D6 | 🟠 | λ1 fixo = 35 | `λ1 = (25 + 12,5·e1/h)/αb`, 35 ≤ λ1 ≤ 90 |
| D7 | 🟠 | As,min só 0,4% Ac | `As,min = max(0,15·Nd/fyd ; 0,004·Ac)` ; As,max = 4% fora da emenda |
| D8 | 🟡 | Es = 200 GPa; σs na compressão = fyd | Es = 210 GPa; σs = 420 MPa com εc = 2‰ |

**Aceitação:** usar exemplo resolvido de livro (ex.: Carvalho & Pinheiro / apostila Bastos UNESP — pilar intermediário) `[CONFIRMAR valores com o professor]`.

## E. Civil — Drenagem (`tubos`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| E1 | 🔴 | `tc` não é Kirpich (dá 26 min onde Kirpich dá 7,1 min) | `tc = 0,0195·L^0,77·S^−0,385` (min; L em m; S em m/m) |
| E2 | 🔴 | Lâmina `y/D ≈ (Q/Qp)^0,46` erra muito (Q/Qp=0,5 → 73% em vez de 50%) | geometria exata da seção circular parcial (θ por bisseção) para y/D e V |
| E3 | 🔴 | Busca de D para em 0,70 m sem avisar | fórmula fechada `D = (4^(5/3)·n·Q/(π·√S))^(3/8)`, dimensionando para y/D ≤ 0,80 |
| E4 | 🟠 | Selo "NBR 10844" (norma predial: calhas/condutores) para rede urbana | rede urbana → citar método racional/manual municipal; NBR 10844 vira cálculo separado (backlog) |
| E5 | 🟡 | `tc` calculado mas não usado; i digitado | ligar `tc` → `i` pela curva IDF (backlog F-C1) |
| E6 | 🟡 | Só velocidade mínima | adicionar V máx (≈ 5 m/s concreto) |

**Aceitação**
- `L=300 m, S=0,02` → `tc = 7,10 min`.
- `Q/Qp = 0,5` → `y/D = 50,0 %`; `y/D = 0,938` ↔ `Q/Qp ≈ 1,076` (máximo).

## F. Elétrica (`cabo_mt`, `cabo_bt`, `curto_circuito`)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| F1 | 🟠 | Fatores de temperatura são de **PVC (70 °C)**, mas os cabos usados são EPR/XLPE (90 °C) | campo "isolação" (PVC / EPR-XLPE) com as duas colunas da NBR 5410 Tab. 40 |
| F2 | 🟠 | Tabela de resistividade do solo diverge da NBR 5410 Tab. 41 | usar Tab. 41 (ref. 2,5 K·m/W; linhas "enterrado direto" e "em eletroduto") `[CONFIRMAR NA NORMA]` |
| F3 | 🟠 | Agrupamento usa Tab. 42 (cabos ao ar) também para enterrados | Tab. 44/45 para enterrados (depende do espaçamento) |
| F4 | 🟠 | Cabo MT usa fatores da NBR 5410 (BT) | fatores da NBR 14039 para MT; profundidade de referência coerente |
| F5 | 🟡 | ΔV depende de K digitado | permitir calcular por `ΔV = √3·I·L·(R·cosφ + X·senφ)` com R/X de tabela |

**Aceitação:** XLPE ao ar 40 °C → `Kt = 0,91`; PVC ao ar 40 °C → `Kt = 0,87` (Tab. 40).

## G. Mecânica
Fórmulas corretas. Ajustes 🟡:
- G1: `conv` — fração arredondada para 1/1 deve somar 1 à parte inteira (hoje mostra `1/1"`).
- G2: `potencia` — mostrar também kW e cv.

## H. Plataforma (afeta todos os cálculos)

| ID | Sev | Problema atual | Comportamento exigido |
|----|-----|----------------|-----------------------|
| H1 | 🔴 | Campo vazio vira `0` (`Number("") = 0`) e o cálculo roda com zero | campo obrigatório vazio → erro "preencha X"; opcional → `undefined` |
| H2 | 🟡 | Tipos de `shared` (`placeholder`, `description`, `dependsOn.values`) divergem do uso (`ph`, `desc`, `dependsOn.in`) | alinhar tipos e remover `@ts-nocheck` aos poucos |
| H3 | 🟠 | Não há testes | `node:test` + `tsx` com os casos de aceitação desta spec |

---

## Fora do escopo
Funcionalidades novas → [backlog](../backlog.md).

## Decisões (2026-11-23)
1. Sem exemplos do professor → valores de referência vêm de **fontes oficiais/públicas** (fórmulas e tabelas
   das normas, apostilas públicas de universidades) e de **contas independentes** feitas nos testes.
2. Isolação dos cabos → campo de escolha (PVC ou EPR/XLPE), padrão EPR/XLPE.
3. Drenagem → **predial (NBR 10844)**: o cálculo `tubos` passa a dimensionar **calha + condutor vertical + condutor horizontal**
   (`Q = I·A/60`, Manning nas calhas e condutores horizontais com lâmina ≤ 2/3·D). As correções E1–E3 continuam valendo
   para a parte de Manning/seção circular parcial.
