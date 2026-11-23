// @ts-nocheck
/**
 * CIVIL — spec 001 (blocos A, B, C, D, E).
 * Cada cálculo: fórmula explícita, norma citada, relatório "── SEÇÃO ──" com ✓/✗/⚠.
 */
import { ceilTo, bisect } from "./lib/math.js";
import {
  GAMMA_C, GAMMA_S, ES, checkFck, checkFyk, fcd as fcdOf, fyd as fydOf, fctm, fctd as fctdOf, alphaV2,
  rhoMinFlexao, KMD_LIM, BX_LIM, bxDeKmd, BARRAS, areaBarra, sugerirEspacamento, armaduraFlexoCompressao,
} from "./lib/concreto.js";
import {
  vazaoCircular, laminaParaVazao, laminaRetangular, vazaoRetangular, kirpich,
} from "./lib/hidraulica.js";

const fx = (x, d = 2) => Number(x).toFixed(d);
const pos = (v, nome) => { if (!(v > 0)) throw new Error(`${nome} deve ser > 0`); };

/* ───────────── helpers exportados (testes) ───────────── */

/** Viga contínua 2 vãos, carga uniforme, EI constante — Teorema dos 3 momentos. */
export function vigaContinua2Vaos(L1, q1, L2, q2, EI) {
  // M_A·L1 + 2·M_B·(L1+L2) + M_C·L2 = −6·Σ(A·ā/L) ; para carga uniforme A·ā/L = q·L³/24
  const MB = -(q1 * L1 ** 3 + q2 * L2 ** 3) / (8 * (L1 + L2));
  const RA = (q1 * L1) / 2 + MB / L1;
  const RB1 = q1 * L1 - RA;
  const RC = (q2 * L2) / 2 + MB / L2;
  const RB2 = q2 * L2 - RC;
  const x1 = RA / q1, M1 = (RA * RA) / (2 * q1);               // medido de A
  const x2 = RC / q2, M2 = (RC * RC) / (2 * q2);               // medido de C
  // Flecha: biapoiada com q + momento MB na extremidade junto a B (superposição exata)
  // δ(x) = q·x·(L³ − 2Lx² + x³)/(24EI) + MB·x·(L² − x²)/(6·EI·L)   (x a partir do apoio externo)
  const flecha = (q, L) => {
    let best = { d: 0, x: 0 };
    for (let i = 1; i < 400; i++) {
      const x = (L * i) / 400;
      const d = (q * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI) + (MB * x * (L * L - x * x)) / (6 * EI * L);
      if (d > best.d) best = { d, x };
    }
    return best;
  };
  return { MB, RA, RB: RB1 + RB2, RB1, RB2, RC, x1, M1, x2, M2, f1: flecha(q1, L1), f2: flecha(q2, L2) };
}

/** Pressões no solo (kPa) — sapata A×B (m), N (kN), M (kN·m) na direção A. */
export function pressaoSolo(N, M, A, B) {
  const e = M / N;
  if (e <= A / 6) {
    return { e, sigMax: (N / (A * B)) * (1 + (6 * e) / A), sigMin: (N / (A * B)) * (1 - (6 * e) / A), triangular: false };
  }
  return { e, sigMax: (2 * N) / (3 * B * (A / 2 - e)), sigMin: 0, triangular: true };
}

/* ═══════════════════════ CÁLCULOS ═══════════════════════ */

const vigaCA = {
  id: "concreto",
  icon: "concrete",
  name: "Dimensionamento — Viga CA (NBR 6118)",
  desc: "flexão (As), armadura mínima, biela comprimida e estribos",
  norma: "NBR 6118:2023",
  formula:
    "fd = 1,4·gk + 1,4·qk | Md = fd·L²/8 | Kmd = Md/(bw·d²·fcd) ≤ 0,251 | βx = (0,68 − √(0,4624 − 1,088·Kmd))/0,544 | " +
    "z = d·(1 − 0,4·βx) | As = Md/(z·fyd) ≥ ρmín·bw·h | Vsd = fd·L/2 ≤ Vrd2 = 0,27·αv2·fcd·bw·d | " +
    "Vc = 0,6·fctd·bw·d | Asw/s = (Vsd − Vc)/(0,9·d·fywd) ≥ 0,2·fct,m·bw/fywk",
  context:
    "Viga biapoiada com carga uniforme, concreto do grupo I (C20–C50). Flexão no ELU com bloco retangular (0,8x · 0,85fcd) e limite de ductilidade x/d ≤ 0,45 (§14.6.4.3) — se Kmd passar de 0,251 a seção precisa crescer (ou usar armadura dupla). Armadura mínima pela Tab. 17.3 sobre a seção bruta bw·h. Cisalhamento pelo Modelo de cálculo I (θ = 45°, estribos verticais, §17.4.2.2): biela comprimida Vrd2 verificada com o cortante no apoio; estribos para Vsw = Vsd − Vc, respeitando a taxa mínima (§17.4.1.1.1) e o espaçamento máximo (§18.3.3.2). Altura útil estimada com estribo φ6,3 e barra longitudinal φ20.",
  fields: [
    { id: "L",   label: "vão livre L",            ph: "6.0", hint: "m"    },
    { id: "bw",  label: "largura bw",             ph: "25",  hint: "cm"   },
    { id: "h",   label: "altura total h",         ph: "60",  hint: "cm"   },
    { id: "cob", label: "cobrimento nominal",     ph: "3.0", hint: "cm"   },
    { id: "fck", label: "fck do concreto",        ph: "25",  hint: "MPa"  },
    { id: "fyk", label: "fyk do aço (CA-50=500)", ph: "500", hint: "MPa"  },
    { id: "gk",  label: "carga perm. gk (total)", ph: "20",  hint: "kN/m" },
    { id: "qk",  label: "carga variável qk",      ph: "15",  hint: "kN/m" },
  ],
  calc(v) {
    pos(v.L, "Vão L"); pos(v.bw, "bw"); pos(v.h, "h"); pos(v.cob, "Cobrimento");
    if (v.gk < 0 || v.qk < 0) throw new Error("Cargas não podem ser negativas");
    checkFck(v.fck); checkFyk(v.fyk);
    const fcd = fcdOf(v.fck), fyd = fydOf(v.fyk);
    const phiT = 0.63, phiL = 2.0; // cm (estimativa)
    const d = v.h - v.cob - phiT - phiL / 2; // cm
    if (d <= 0) throw new Error("Cobrimento incompatível com a altura");

    const fd = 1.4 * v.gk + 1.4 * v.qk;               // kN/m
    const Md = (fd * v.L * v.L) / 8;                   // kN·m
    const bwmm = v.bw * 10, dmm = d * 10;
    const Kmd = (Md * 1e6) / (bwmm * dmm * dmm * fcd);
    if (Kmd > KMD_LIM) throw new Error(`Kmd = ${fx(Kmd, 3)} > ${fx(KMD_LIM, 3)} (x/d > 0,45) — seção insuficiente: aumente h ou bw (ou use armadura dupla)`);
    const bx = bxDeKmd(Kmd);
    const z = d * (1 - 0.4 * bx);                      // cm
    const As = (Md * 1e6) / (z * 10 * fyd) / 100;      // cm²
    const rhoMin = rhoMinFlexao(v.fck);
    const AsMin = rhoMin * v.bw * v.h;
    const AsMax = 0.04 * v.bw * v.h;
    const AsAdot = Math.max(As, AsMin);
    if (AsAdot > AsMax) throw new Error(`As = ${fx(AsAdot)} cm² > As,máx = 4%·Ac = ${fx(AsMax)} cm²`);
    const sug = BARRAS.filter((b) => b.phi >= 10 && b.phi <= 25)
      .map((b) => { const n = Math.max(2, Math.ceil(AsAdot / b.area - 1e-9)); return `${n}φ${b.phi} (${fx(n * b.area)} cm²)`; }).join(" | ");

    // Cisalhamento — Modelo I
    const Vsd = (fd * v.L) / 2;                                    // kN (no apoio)
    const av2 = alphaV2(v.fck);
    const Vrd2 = (0.27 * av2 * fcd * bwmm * dmm) / 1e3;             // kN
    const bielaOk = Vsd <= Vrd2;
    const fctd = fctdOf(v.fck);
    const Vc = (0.6 * fctd * bwmm * dmm) / 1e3;                     // kN
    const fywk = 500, fywd = Math.min(fywk / GAMMA_S, 435);
    const Vsw = Math.max(Vsd - Vc, 0);
    const AswS = Vsw > 0 ? (Vsw * 1e3) / (0.9 * dmm * fywd) * 10 : 0;  // cm²/m
    const AswMin = (0.2 * fctm(v.fck) / fywk) * v.bw * 100;           // cm²/m
    const AswAdot = Math.max(AswS, AswMin);
    const sMax = Vsd <= 0.67 * Vrd2 ? Math.min(0.6 * d, 30) : Math.min(0.3 * d, 20); // cm
    const estribos = [5, 6.3, 8, 10].map((phi) => {
      const s = Math.floor(((2 * areaBarra(phi)) / AswAdot) * 100);   // 2 ramos
      return { phi, s: Math.min(s, Math.floor(sMax)) };
    }).filter((e) => e.s >= 7).slice(0, 2);

    return {
      val: [
        `── ESFORÇOS ──────────────────────────`,
        `fd = 1,4·${v.gk} + 1,4·${v.qk} = ${fx(fd)} kN/m`,
        `Md = fd·L²/8 = ${fx(Md)} kN·m`,
        `Vsd (apoio) = fd·L/2 = ${fx(Vsd)} kN`,
        `── MATERIAIS ─────────────────────────`,
        `fcd = fck/${GAMMA_C} = ${fx(fcd)} MPa   fyd = fyk/${GAMMA_S} = ${fx(fyd)} MPa`,
        `── FLEXÃO ────────────────────────────`,
        `d = h − cob − φt − φl/2 = ${fx(d, 1)} cm   (φt 6,3 mm; φl 20 mm estimados)`,
        `Kmd = ${fx(Kmd, 4)}  (limite ${fx(KMD_LIM, 3)} ↔ x/d = ${BX_LIM})`,
        `βx = x/d = ${fx(bx, 3)}   z = ${fx(z, 1)} cm`,
        `As calculada:  ${fx(As)} cm²`,
        `As mínima:     ${fx(AsMin)} cm²  (ρmín ${fx(rhoMin * 100, 3)} % · bw·h — Tab. 17.3)`,
        `As adotada:    ${fx(AsAdot)} cm²  ${As < AsMin ? "(governa a mínima)" : ""}`,
        `Sugestões:     ${sug}`,
        `── CISALHAMENTO (Modelo I) ───────────`,
        `Vrd2 = 0,27·αv2·fcd·bw·d = ${fx(Vrd2)} kN  (αv2 = ${fx(av2, 3)})`,
        bielaOk ? `✓ Vsd ≤ Vrd2 — biela comprimida OK` : `✗ Vsd > Vrd2 — AUMENTAR SEÇÃO (bw ou h)`,
        `Vc = 0,6·fctd·bw·d = ${fx(Vc)} kN  (fctd = ${fx(fctd, 3)} MPa)`,
        `Vsw = Vsd − Vc = ${fx(Vsw)} kN`,
        `Asw/s calc.:   ${fx(AswS)} cm²/m   (fywd = ${fx(fywd)} MPa, estribos CA-50)`,
        `Asw/s mínimo:  ${fx(AswMin)} cm²/m   (0,2·fct,m/fywk·bw)`,
        `Asw/s adotado: ${fx(AswAdot)} cm²/m   s,máx = ${fx(sMax, 1)} cm`,
        estribos.length
          ? `Estribos (2 ramos): ${estribos.map((e) => `φ${e.phi} c/ ${e.s} cm`).join(" | ")}`
          : `⚠ estribos muito densos — aumente a seção`,
        `⚠ ELS (flecha e fissuração) não verificados neste módulo`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "dimensionamento CA",
};

const sapata = {
  id: "fundacao",
  icon: "foundation",
  name: "Sapata Isolada Rígida — Dimensionamento",
  desc: "área pela tensão admissível, altura rígida, armaduras e biela comprimida",
  norma: "NBR 6122 + NBR 6118",
  formula:
    "A·B = 1,05·Nk/σadm  com  A − B = a − b | σmáx = N/(A·B)·(1 + 6e/A) ≤ σadm, e = Mk/N ≤ A/6 | " +
    "h ≥ (A − a)/3 | x₁ = (A − a)/2 + 0,15a | M₁d = σd·B·x₁²/2 | As = M₁d/(0,85·d·fyd) | " +
    "τsd = Nd/(u₀·d) ≤ τRd2 = 0,27·αv2·fcd",
  context:
    "Sapata isolada rígida sob pilar retangular, com cargas de SERVIÇO (Nk, Mk) para o solo e de CÁLCULO (×1,4) para o concreto e o aço. Dimensões em planta por balanços iguais (A − B = a − b), com peso próprio estimado em 5% de Nk; a sapata é ampliada até que não haja tração no solo (e ≤ A/6) e σmáx ≤ σadm. A altura mínima para comportamento rígido é h ≥ (A − a)/3 (NBR 6118 §22.6.1) — se h não for informado, o sistema calcula. Armadura de flexão pelo método das bielas/CEB-70 na seção de referência S1 (0,15·a para dentro do pilar). Em sapata rígida não há punção por tração diagonal; verifica-se a biela comprimida no contorno do pilar C (§22.6.2.2 / §19.5.3.1).",
  fields: [
    { id: "Nk",    label: "carga normal de serviço Nk",       ph: "800", hint: "kN"   },
    { id: "Mk",    label: "momento de serviço Mk (dir. A)",   ph: "0",   hint: "kN·m" },
    { id: "ap",    label: "dimensão do pilar a (dir. A)",     ph: "40",  hint: "cm"   },
    { id: "bp",    label: "dimensão do pilar b",              ph: "40",  hint: "cm"   },
    { id: "sigAd", label: "tensão admissível do solo σadm",   ph: "200", hint: "kPa"  },
    { id: "fck",   label: "fck do concreto",                  ph: "25",  hint: "MPa"  },
    { id: "fyk",   label: "fyk do aço",                       ph: "500", hint: "MPa"  },
    { id: "cobs",  label: "cobrimento nominal",               ph: "5",   hint: "cm"   },
    { id: "hs",    label: "altura h (opcional — calcula se vazio)", ph: "", hint: "cm", optional: true },
  ],
  calc(v) {
    pos(v.Nk, "Nk"); pos(v.sigAd, "σadm"); pos(v.ap, "a"); pos(v.bp, "b"); pos(v.cobs, "Cobrimento");
    if (v.Mk < 0) throw new Error("Informe Mk em módulo (≥ 0)");
    checkFck(v.fck); checkFyk(v.fyk);
    const a = v.ap / 100, b = v.bp / 100;
    const N = 1.05 * v.Nk;                                  // kN (serviço + peso próprio)
    const area = N / v.sigAd;                               // m²
    const dif = a - b;
    let B = ceilTo((-dif + Math.sqrt(dif * dif + 4 * area)) / 2, 0.05);
    let A = ceilTo(B + dif, 0.05);
    let p = pressaoSolo(N, v.Mk, A, B), iter = 0;
    while ((p.triangular || p.sigMax > v.sigAd) && iter++ < 400) {
      if (p.triangular) A += 0.05; else { A += 0.05; B += 0.05; }
      p = pressaoSolo(N, v.Mk, A, B);
    }

    // Altura (rígida)
    const hMin = Math.max(ceilTo(Math.max((A - a) / 3, (B - b) / 3), 0.05), 0.25);
    const hInf = v.hs > 0 ? v.hs / 100 : null;
    const h = hInf ? Math.max(hInf, hMin) : hMin;
    const phi = 1.25; // cm, estimado
    const dA = h * 100 - v.cobs - phi / 2, dB = dA - phi; // cm
    const dMed = (dA + dB) / 2;

    // ELU
    const fcd = fcdOf(v.fck), fyd = fydOf(v.fyk);
    const Nd = 1.4 * v.Nk, Md = 1.4 * v.Mk;
    const pd = pressaoSolo(Nd, Md, A, B);
    const sigMed = Nd / (A * B);
    const x1A = (A - a) / 2 + 0.15 * a, x1B = (B - b) / 2 + 0.15 * b; // m
    const M1A = (pd.sigMax * B * x1A * x1A) / 2;   // kN·m (σmáx, a favor da segurança)
    const M1B = (sigMed * A * x1B * x1B) / 2;      // kN·m
    const AsA = (M1A * 1e6) / (0.85 * dA * 10 * fyd) / 100;  // cm² (barras paralelas a A)
    const AsB = (M1B * 1e6) / (0.85 * dB * 10 * fyd) / 100;
    const rhoMin = rhoMinFlexao(v.fck);
    const AsAmin = rhoMin * B * 100 * h * 100, AsBmin = rhoMin * A * 100 * h * 100;
    const AsAf = Math.max(AsA, AsAmin), AsBf = Math.max(AsB, AsBmin);
    const malha = (As, largura) => {
      const porM = As / largura;
      const op = sugerirEspacamento(porM, [10, 12.5, 16, 20], 10, 20);
      return op.length ? op.slice(0, 2).map((o) => `φ${o.phi} c/ ${o.s} cm`).join(" | ") : "⚠ revisar (espaçamento fora de 10–20 cm)";
    };

    // Biela comprimida no contorno C
    const u0 = 2 * (v.ap + v.bp) * 10;                 // mm
    const tauSd = (Nd * 1e3) / (u0 * dMed * 10);       // MPa
    const tauRd2 = 0.27 * alphaV2(v.fck) * fcd;
    const bielaOk = tauSd <= tauRd2;

    return {
      val: [
        `── GEOMETRIA ────────────────────────`,
        `N serviço + pp: 1,05·Nk = ${fx(N, 1)} kN`,
        `Área necessária: ${fx(area, 3)} m²  → A × B = ${fx(A)} × ${fx(B)} m (${fx(A * B, 3)} m²)`,
        `Balanços: ${fx((A - a) / 2, 3)} m (dir. A) / ${fx((B - b) / 2, 3)} m (dir. B)`,
        `h mínimo (rígida) = (A − a)/3 = ${fx(hMin, 2)} m`,
        hInf
          ? (hInf >= hMin ? `✓ h informado ${fx(hInf)} m — sapata rígida` : `✗ h informado ${fx(hInf)} m < h mín — ADOTADO h = ${fx(hMin)} m`)
          : `h adotado:  ${fx(h)} m (calculado)`,
        `── PRESSÕES NO SOLO (serviço) ───────`,
        `e = Mk/N = ${fx(p.e, 3)} m  (A/6 = ${fx(A / 6, 3)} m) ${p.triangular ? "✗" : "✓ sem tração"}`,
        `σmáx = ${fx(p.sigMax)} kPa  σmín = ${fx(p.sigMin)} kPa`,
        p.sigMax <= v.sigAd ? `✓ σmáx ≤ σadm (${fx(v.sigAd, 0)} kPa)` : `✗ σmáx > σadm — revisar`,
        `── ARMADURAS (ELU, Nd = 1,4·Nk = ${fx(Nd, 1)} kN) ──`,
        `d (dir. A / B): ${fx(dA, 1)} / ${fx(dB, 1)} cm`,
        `M1d,A = ${fx(M1A)} kN·m   (x₁ = ${fx(x1A, 3)} m)`,
        `M1d,B = ${fx(M1B)} kN·m   (x₁ = ${fx(x1B, 3)} m)`,
        `As,A = ${fx(AsAf)} cm² ${AsA < AsAmin ? "(mínima)" : ""} → ${malha(AsAf, B)}`,
        `As,B = ${fx(AsBf)} cm² ${AsB < AsBmin ? "(mínima)" : ""} → ${malha(AsBf, A)}`,
        `── BIELA COMPRIMIDA (contorno C) ────`,
        `u₀ = 2·(a + b) = ${fx(u0 / 1000, 3)} m`,
        `τsd = Nd/(u₀·d) = ${fx(tauSd, 3)} MPa   τRd2 = ${fx(tauRd2, 3)} MPa`,
        bielaOk ? `✓ τsd ≤ τRd2 — OK (sapata rígida dispensa punção por tração)` : `✗ τsd > τRd2 — aumentar h ou a seção do pilar`,
        `⚠ σmáx ≤ σadm adotado de forma conservadora; confira o acréscimo admitido pela NBR 6122 para ações de vento`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "dimensionamento sapata",
};

const pilar = {
  id: "resistencia",
  icon: "sigma",
  name: "Pilar CA — 2ª Ordem e Flexo-compressão (NBR 6118)",
  desc: "esbeltez nas 2 direções, momento mínimo, curvatura aproximada, armadura As",
  norma: "NBR 6118 §15.8",
  formula:
    "le = β·lc | λ = le·√12/h | M1d,mín = Nd·(0,015 + 0,03h) | λ1 = 25 + 12,5·e1/h (35 ≤ λ1 ≤ 90) | " +
    "ν = Nd/(Ac·fcd) | 1/r = 0,005/(h·(ν + 0,5)) ≤ 0,005/h | Md,tot = M1d + Nd·le²/10·(1/r) | " +
    "As por equilíbrio da seção (flexo-compressão, As simétrica) ≥ máx(0,15·Nd/fyd; 0,4%·Ac)",
  context:
    "Pilar retangular de concreto armado sob compressão com momento de 1ª ordem numa direção (h). Verifica as DUAS direções: em cada uma calcula esbeltez λ, momento mínimo (§11.3.3.4.3) e, quando λ > λ1, o efeito de 2ª ordem pelo método do pilar-padrão com curvatura aproximada (§15.8.3.3.2, válido para λ ≤ 90). A armadura é obtida por equilíbrio da seção (domínios de deformação, bloco 0,8x · 0,85fcd, armadura simétrica em duas faces) para a direção mais crítica. Simplificações: αb = 1 (a favor da segurança), flexão oblíqua não combinada, coeficiente γn aplicado se a menor dimensão < 19 cm (Tab. 13.1).",
  fields: [
    { id: "Nd",   label: "força normal de cálculo Nd",    ph: "1500", hint: "kN"   },
    { id: "M1d",  label: "momento de 1ª ordem M1d (dir. h)", ph: "60", hint: "kN·m" },
    { id: "lc",   label: "comprimento do pilar lc",       ph: "3.0",  hint: "m"    },
    { id: "beta", label: "coef. de vínculo β (biarticulado=1)", ph: "1", hint: "—"  },
    { id: "bP",   label: "dimensão b da seção",           ph: "25",   hint: "cm"   },
    { id: "hP",   label: "dimensão h da seção (dir. M1d)", ph: "50",  hint: "cm"   },
    { id: "fck",  label: "fck",                           ph: "30",   hint: "MPa"  },
    { id: "fyk",  label: "fyk",                           ph: "500",  hint: "MPa"  },
    { id: "dl",   label: "d' — centro da barra à face (opcional, padrão 4)", ph: "4", hint: "cm", optional: true },
  ],
  calc(v) {
    pos(v.Nd, "Nd"); pos(v.lc, "lc"); pos(v.bP, "b"); pos(v.hP, "h");
    if (!(v.beta > 0 && v.beta <= 2)) throw new Error("β deve estar entre 0 e 2");
    if (v.M1d < 0) throw new Error("Informe M1d em módulo (≥ 0)");
    checkFck(v.fck); checkFyk(v.fyk);
    const bmin = Math.min(v.bP, v.hP);
    if (bmin < 14) throw new Error("Menor dimensão < 14 cm não permitida (NBR 6118 §13.2.3)");
    const gn = bmin < 19 ? 1.95 - 0.05 * bmin : 1;
    const Nd = v.Nd * gn, M1dIn = v.M1d * gn;
    const dl = v.dl > 0 ? v.dl : 4;
    const fcd = fcdOf(v.fck), fyd = fydOf(v.fyk);
    const Ac = v.bP * v.hP; // cm²
    const nu = (Nd * 1e3) / (Ac * 100 * fcd);
    const le = v.beta * v.lc; // m

    const direcao = (nome, hDir, bDir, M1) => {
      const hm = hDir / 100;
      const lambda = (le * Math.sqrt(12)) / hm;
      if (lambda > 90) throw new Error(`λ${nome} = ${fx(lambda, 1)} > 90 — o método da curvatura aproximada não se aplica (exige fluência / método geral)`);
      const Mmin = Nd * (0.015 + 0.03 * hm);
      const M1d = Math.max(M1, Mmin);
      const e1 = M1d / Nd;
      const lambda1 = Math.min(90, Math.max(35, 25 + (12.5 * e1) / hm));
      let M2 = 0, invR = 0;
      if (lambda > lambda1) {
        invR = Math.min(0.005 / (hm * (nu + 0.5)), 0.005 / hm);
        M2 = (Nd * le * le / 10) * invR;
      }
      const Mtot = M1d + M2;
      const secao = { b: bDir * 10, h: hDir * 10, dl: dl * 10, fcd, fyd };
      const r = armaduraFlexoCompressao(secao, Nd * 1e3, Mtot * 1e6, 0.08 * Ac * 100);
      return { nome, hDir, lambda, lambda1, Mmin, M1d, M2, Mtot, invR, As: r ? r.As / 100 : null, x: r ? r.x / 10 : null };
    };
    const dh = direcao("h", v.hP, v.bP, M1dIn);
    const db = direcao("b", v.bP, v.hP, 0);
    if (dh.As === null || db.As === null) throw new Error("Seção insuficiente mesmo com 8% de armadura — aumente a seção ou o fck");
    const crit = dh.As > db.As + 1e-6 || (Math.abs(dh.As - db.As) <= 1e-6 && dh.Mtot / dh.hDir >= db.Mtot / db.hDir) ? dh : db;
    const AsMin = Math.max((0.15 * Nd * 1e3) / fyd / 100, 0.004 * Ac);
    const AsMax = 0.04 * Ac;
    const As = Math.max(crit.As, AsMin);
    const phiMax = Math.min(v.bP, v.hP) * 10 / 8;
    const sug = BARRAS.filter((b) => b.phi >= 10 && b.phi <= phiMax).map((b) => {
      let n = Math.max(4, Math.ceil(As / b.area - 1e-9)); if (n % 2) n++;
      return `${n}φ${b.phi} (${fx(n * b.area)} cm²)`;
    }).slice(0, 3).join(" | ");

    const linhaDir = (d) => [
      `── DIREÇÃO ${d.nome.toUpperCase()} (${d.hDir} cm) ──────────────────`,
      `λ = le·√12/${d.nome} = ${fx(d.lambda, 1)}   λ1 = ${fx(d.lambda1, 1)}  ${d.lambda <= d.lambda1 ? "(dispensa 2ª ordem)" : "(considera 2ª ordem)"}`,
      `M1d,mín = Nd·(0,015 + 0,03·${d.nome}) = ${fx(d.Mmin)} kN·m → M1d = ${fx(d.M1d)} kN·m`,
      d.M2 > 0 ? `1/r = ${d.invR.toExponential(3)} 1/m   M2d = Nd·le²/10·(1/r) = ${fx(d.M2)} kN·m` : `M2d = 0`,
      `Md,tot = ${fx(d.Mtot)} kN·m   → As necessária ${fx(d.As)} cm²`,
    ];

    return {
      val: [
        `── DADOS ────────────────────────────`,
        `le = β·lc = ${fx(le)} m   Ac = ${fx(Ac, 0)} cm²   ν = ${fx(nu, 3)}`,
        gn > 1 ? `⚠ menor dimensão < 19 cm → γn = ${fx(gn)} aplicado a Nd e M1d` : `γn = 1,00`,
        ...linhaDir(dh),
        ...linhaDir(db),
        `── ARMADURA LONGITUDINAL ────────────`,
        `Direção crítica: ${crit.nome}   (linha neutra x = ${fx(crit.x, 1)} cm)`,
        `As,mín = máx(0,15·Nd/fyd; 0,4%·Ac) = ${fx(AsMin)} cm²`,
        `As adotada: ${fx(As)} cm²  (ρ = ${fx((As / Ac) * 100, 2)} %)`,
        As <= AsMax ? `✓ As ≤ 4%·Ac = ${fx(AsMax)} cm² (8% só na região de emenda)` : `✗ As > 4%·Ac — aumentar seção`,
        `Sugestões (φ ≤ b/8): ${sug}`,
        `⚠ flexão oblíqua não combinada; αb = 1 adotado`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "pilar CA",
};

const vigaContinua = {
  id: "deflexao",
  icon: "deflect",
  name: "Viga Contínua 2 Vãos — Teorema dos 3 Momentos",
  desc: "momento no apoio central, reações, momentos positivos e flechas",
  norma: "Clapeyron · NBR 6118 Tab. 13.3",
  formula:
    "M_B = −(q₁L₁³ + q₂L₂³) / (8·(L₁ + L₂)) | R_A = q₁L₁/2 + M_B/L₁ | R_C = q₂L₂/2 + M_B/L₂ | " +
    "R_B = q₁L₁ + q₂L₂ − R_A − R_C | M⁺ = R²/(2q) | δ(x) = q·x(L³ − 2Lx² + x³)/(24EI) + M_B·x(L² − x²)/(6EI·L)",
  context:
    "Viga contínua de dois vãos com carga uniforme em cada vão, apoios externos articulados e rigidez EI constante. O momento no apoio central M_B vem da equação dos três momentos (Clapeyron): M_A·L₁ + 2M_B(L₁+L₂) + M_C·L₂ = −q₁L₁³/4 − q₂L₂³/4. As reações saem do equilíbrio de cada vão, o momento positivo máximo ocorre onde o cortante zera (M⁺ = R²/2q, medido a partir do apoio externo) e a flecha máxima é obtida pela superposição exata (carga uniforme + momento M_B) varrendo o vão. Para concreto armado use EI efetivo (fissurado) e lembre que a flecha final inclui a fluência; limites da Tab. 13.3: L/250 (visual) e L/500 (paredes).",
  fields: [
    { id: "L1", label: "vão 1 — comprimento L₁",    ph: "7.0",   hint: "m"     },
    { id: "q1", label: "vão 1 — carga distrib. q₁", ph: "25",    hint: "kN/m"  },
    { id: "L2", label: "vão 2 — comprimento L₂",    ph: "5.5",   hint: "m"     },
    { id: "q2", label: "vão 2 — carga distrib. q₂", ph: "18",    hint: "kN/m"  },
    { id: "EI", label: "rigidez E·I (constante)",   ph: "45000", hint: "kN·m²" },
  ],
  calc(v) {
    pos(v.L1, "L₁"); pos(v.L2, "L₂"); pos(v.q1, "q₁"); pos(v.q2, "q₂"); pos(v.EI, "EI");
    const r = vigaContinua2Vaos(v.L1, v.q1, v.L2, v.q2, v.EI);
    const lim = (L, d) => `[L/250 = ${fx((L * 1000) / 250, 1)} ${d <= (L * 1000) / 250 ? "✓" : "✗"} | L/500 = ${fx((L * 1000) / 500, 1)} ${d <= (L * 1000) / 500 ? "✓" : "✗"}]`;
    const d1 = r.f1.d * 1000, d2 = r.f2.d * 1000;
    return {
      val: [
        `── MOMENTOS (kN·m) ──────────────────`,
        `M_A = 0 (articulado)   M_C = 0 (articulado)`,
        `M_B = ${fx(r.MB)}  ← momento negativo no apoio central`,
        `M⁺ vão 1 = ${fx(r.M1)}  em x = ${fx(r.x1)} m (de A)`,
        `M⁺ vão 2 = ${fx(r.M2)}  em x = ${fx(r.x2)} m (de C)`,
        `── REAÇÕES (kN) ─────────────────────`,
        `R_A = ${fx(r.RA)}`,
        `R_B = ${fx(r.RB)}  (${fx(r.RB1)} + ${fx(r.RB2)})`,
        `R_C = ${fx(r.RC)}`,
        `Verificação: ΣR = ${fx(r.RA + r.RB + r.RC)} = q₁L₁ + q₂L₂ = ${fx(v.q1 * v.L1 + v.q2 * v.L2)} ✓`,
        `── FLECHAS (EI informado) ───────────`,
        `δ máx vão 1 = ${fx(d1)} mm em x = ${fx(r.f1.x)} m  ${lim(v.L1, d1)}`,
        `δ máx vão 2 = ${fx(d2)} mm em x = ${fx(r.f2.x)} m  ${lim(v.L2, d2)}`,
        `⚠ concreto armado: use EI fissurado e inclua fluência (flecha diferida)`,
        `── USAR NO DIMENSIONAMENTO CA ───────`,
        `→ momento negativo (apoio B): ${fx(Math.abs(r.MB))} kN·m`,
        `→ momento positivo máx.: ${fx(Math.max(r.M1, r.M2))} kN·m (vão ${r.M1 >= r.M2 ? "1" : "2"})`,
        `→ cargas de serviço? multiplique por 1,4 para obter os esforços de cálculo`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "viga contínua",
};

/* Coeficientes de Manning — NBR 10844 Tab. 2 */
const MANNING_PREDIAL = [
  { value: "0.011", label: "Plástico, fibrocimento, aço, metais não-ferrosos (n = 0,011)" },
  { value: "0.012", label: "Ferro fundido, concreto alisado, alvenaria revestida (n = 0,012)" },
  { value: "0.013", label: "Cerâmica, concreto não alisado (n = 0,013)" },
  { value: "0.015", label: "Alvenaria de tijolos não revestida (n = 0,015)" },
];
const DN_PREDIAL = [50, 75, 100, 125, 150, 200, 250, 300]; // mm

const drenagemPredial = {
  id: "tubos",
  icon: "pipe",
  name: "Águas Pluviais Prediais — Calha e Condutores (NBR 10844)",
  desc: "vazão de projeto, lâmina na calha, diâmetro dos condutores horizontal e vertical",
  norma: "NBR 10844",
  formula:
    "A = (a + h/2)·b | Q = I·A/60 (L/min) | Q = (1/n)·A_m·Rh^(2/3)·S^(1/2) (Manning) | " +
    "condutor horizontal com lâmina y = 2/3·D | condutor vertical D ≥ 70 mm",
  context:
    "Dimensionamento de calha retangular e condutores de águas pluviais de cobertura inclinada (NBR 10844). Área de contribuição de telhado inclinado: A = (a + h/2)·b (§5.2, Fig. 2). Vazão Q = I·A/60 com I em mm/h — período de retorno: 1 ano para áreas pavimentadas onde empoçamento é tolerável, 5 anos para coberturas/terraços e 25 anos onde empoçamento não pode ser tolerado; para coberturas de até 100 m² de projeção pode-se adotar I = 150 mm/h. Calha e condutores horizontais por Manning (Tab. 2 de rugosidade), declividade mínima 0,5%; condutores horizontais com lâmina de 2/3 do diâmetro. A vazão é dividida igualmente entre os condutores verticais.",
  fields: [
    { id: "I",     label: "intensidade pluviométrica I",          ph: "150",  hint: "mm/h" },
    { id: "a",     label: "a — projeção horizontal do pano (beiral→cumeeira)", ph: "5", hint: "m" },
    { id: "hT",    label: "h — altura da cumeeira acima do beiral", ph: "1.5", hint: "m" },
    { id: "b",     label: "b — comprimento do pano (= calha)",    ph: "12",   hint: "m"    },
    { id: "nCond", label: "nº de condutores verticais",           ph: "2",    hint: "un"   },
    { id: "mat",   label: "Material (rugosidade de Manning)",     type: "select", options: MANNING_PREDIAL },
    { id: "wC",    label: "largura da calha",                     ph: "15",   hint: "cm"   },
    { id: "sC",    label: "declividade da calha",                 ph: "0.5",  hint: "%"    },
    { id: "sH",    label: "declividade do condutor horizontal",   ph: "1",    hint: "%"    },
  ],
  calc(v) {
    pos(v.I, "I"); pos(v.a, "a"); pos(v.b, "b"); pos(v.wC, "Largura da calha");
    if (v.hT < 0) throw new Error("h não pode ser negativo");
    if (!(v.nCond >= 1) || !Number.isInteger(v.nCond)) throw new Error("Nº de condutores deve ser inteiro ≥ 1");
    if (!(v.sC >= 0.5)) throw new Error("Declividade da calha ≥ 0,5% (NBR 10844 §5.5.1)");
    if (!(v.sH >= 0.5)) throw new Error("Declividade do condutor horizontal ≥ 0,5% (NBR 10844 §5.7.1)");
    const n = Number(v.mat);
    const A = (v.a + v.hT / 2) * v.b;               // m²
    const Q = (v.I * A) / 60;                       // L/min
    const Qc = Q / v.nCond;                         // L/min por condutor / trecho de calha
    const Qm3s = Qc / 60000;
    // Calha retangular
    const w = v.wC / 100, sC = v.sC / 100;
    const y = laminaRetangular(w, Qm3s, n, sC);
    const Hcalha = Math.ceil(y * 2 * 100);          // cm (lâmina ≤ metade da altura)
    const Vc = vazaoRetangular(w, y, n, sC).V;
    // Condutor horizontal (lâmina 2/3 D)
    const sH = v.sH / 100;
    const cap = DN_PREDIAL.map((D) => ({ D, Q: vazaoCircular(D / 1000, 2 / 3, n, sH).Q * 60000 }));
    const horiz = cap.find((c) => c.Q >= Qc);
    // Condutor vertical
    const Dv = Math.max(75, horiz ? Math.min(horiz.D, 150) : 150);
    return {
      val: [
        `── VAZÃO DE PROJETO ─────────────────`,
        `A = (a + h/2)·b = (${v.a} + ${v.hT}/2)·${v.b} = ${fx(A)} m²`,
        `Q = I·A/60 = ${fx(Q, 1)} L/min  (${fx(Q / 60, 2)} L/s)`,
        `Q por condutor/trecho: ${fx(Qc, 1)} L/min  (${v.nCond} condutor(es))`,
        A <= 100 ? `→ cobertura ≤ 100 m²: I = 150 mm/h é aceito pela norma` : `→ use I da Tab. 5 da NBR 10844 para a cidade e o período de retorno`,
        `── CALHA RETANGULAR (largura ${v.wC} cm, n = ${n}) ──`,
        `Lâmina y = ${fx(y * 100, 1)} cm   V = ${fx(Vc)} m/s`,
        `Altura mínima recomendada: ${Hcalha} cm (lâmina ≤ 50% da altura)`,
        `── CONDUTOR HORIZONTAL (S = ${v.sH}%, y = 2/3·D) ──`,
        ...cap.filter((c) => c.D >= 75).slice(0, 5).map((c) => `DN ${c.D}: ${fx(c.Q, 0)} L/min ${c.Q >= Qc ? "✓" : "✗"}`),
        horiz ? `✓ Adotar DN ${horiz.D} mm` : `✗ Nenhum DN ≤ 300 mm atende — aumente o nº de condutores`,
        `── CONDUTOR VERTICAL ────────────────`,
        `Diâmetro mínimo: 70 mm (NBR 10844 §5.6.3) → sugerido DN ${Dv} mm`,
        `⚠ confirme no ábaco da NBR 10844 (Fig. 3/4) com Q = ${fx(Qc, 0)} L/min, H = ${fx(y * 1000, 0)} mm de lâmina e o comprimento L do condutor`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "águas pluviais",
};

const DN_URBANO = [0.3, 0.4, 0.5, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0];

const redeUrbana = {
  id: "rede_urbana",
  icon: "pipe",
  name: "Rede de Drenagem Urbana — Método Racional",
  desc: "tempo de concentração, vazão de projeto, DN para lâmina ≤ 80%",
  norma: "Método racional",
  formula:
    "tc = 0,0195·L^0,77·S^−0,385 (Kirpich, min) | Q = C·i·A/360 (m³/s; i mm/h; A ha) | " +
    "θ = 2·acos(1 − 2y/D) | A_m = D²/8·(θ − senθ) | Rh = A_m/(D·θ/2) | Q = (1/n)·A_m·Rh^(2/3)·S^(1/2)",
  context:
    "Galeria circular de drenagem urbana para bacias pequenas (até ~2 km², limite usual do método racional). O tempo de concentração de Kirpich indica a duração da chuva a usar na curva IDF da cidade para obter i (TR usual: 10 anos para microdrenagem, 25+ para macrodrenagem). A capacidade do tubo é calculada com a geometria exata da seção parcialmente cheia (Manning), escolhendo o menor DN comercial com lâmina y/D ≤ 80% e verificando velocidades entre 0,6 m/s (autolimpeza) e 5,0 m/s (abrasão). Critérios variam por município — confira o manual de drenagem local.",
  fields: [
    { id: "A",   label: "área da bacia A",                ph: "2.5",   hint: "ha"   },
    { id: "C",   label: "coef. de escoamento C",          ph: "0.85",  hint: "0–1"  },
    { id: "i",   label: "intensidade pluviométrica i",    ph: "120",   hint: "mm/h" },
    { id: "L",   label: "comprimento do talvegue L",      ph: "300",   hint: "m"    },
    { id: "S",   label: "declividade S (bacia e tubo)",   ph: "0.02",  hint: "m/m"  },
    { id: "nMn", label: "coef. de Manning n (concreto=0,013)", ph: "0.013", hint: "—" },
    { id: "Dc",  label: "DN a verificar (opcional)",      ph: "600",   hint: "mm", optional: true },
  ],
  calc(v) {
    pos(v.A, "Área"); pos(v.i, "i"); pos(v.L, "L"); pos(v.nMn, "n");
    if (!(v.C > 0 && v.C <= 1)) throw new Error("C deve estar entre 0 e 1");
    if (!(v.S > 0 && v.S <= 0.5)) throw new Error("Declividade S deve ser 0 < S ≤ 0,5");
    const tc = kirpich(v.L, v.S);
    const Q = (v.C * v.i * v.A) / 360;
    const ad = DN_URBANO.find((D) => vazaoCircular(D, 0.8, v.nMn, v.S).Q >= Q);
    const verif = (D) => {
      const yD = laminaParaVazao(D, Q, v.nMn, v.S);
      if (yD === null) return { D, yD: null };
      const r = vazaoCircular(D, yD, v.nMn, v.S);
      return { D, yD, V: r.V };
    };
    const lines = [
      `── HIDROLOGIA ───────────────────────`,
      `tc (Kirpich) = ${fx(tc, 1)} min  → use chuva de duração ≈ tc na curva IDF`,
      `Q = C·i·A/360 = ${fx(Q, 4)} m³/s  (${fx(Q * 1000, 1)} L/s)`,
      `── DIMENSIONAMENTO (y/D ≤ 80%) ──────`,
    ];
    if (ad) {
      const r = verif(ad);
      lines.push(
        `DN adotado: ${fx(ad * 1000, 0)} mm  (lâmina ${fx(r.yD * 100, 1)} %, V = ${fx(r.V)} m/s)`,
        r.V >= 0.6 ? (r.V <= 5 ? `✓ 0,6 ≤ V ≤ 5,0 m/s` : `⚠ V > 5,0 m/s — reduzir declividade (degraus/poços de queda)`) : `⚠ V < 0,6 m/s — risco de deposição, aumentar declividade`,
      );
    } else lines.push(`✗ Q excede DN 2000 mm — dividir a bacia ou usar galeria celular`);
    if (v.Dc > 0) {
      const r = verif(v.Dc / 1000);
      lines.push(`── VERIFICAÇÃO DN ${v.Dc} mm ──────────`);
      if (r.yD === null) lines.push(`✗ DN ${v.Dc} mm INSUFICIENTE — trabalharia em carga`);
      else lines.push(
        `Lâmina y/D = ${fx(r.yD * 100, 1)} %  ${r.yD <= 0.8 ? "✓ ≤ 80%" : "✗ > 80% — AUMENTAR DN"}`,
        `V = ${fx(r.V)} m/s ${r.V >= 0.6 && r.V <= 5 ? "✓" : "⚠ fora de 0,6–5,0 m/s"}`,
      );
    }
    return { val: lines.join("\n"), unit: "", multi: true };
  },
  result: "rede urbana",
};

export const CIVIL = {
  label: "Civil",
  icon: "foundation",
  calcs: [vigaCA, sapata, drenagemPredial, redeUrbana, pilar, vigaContinua],
};
