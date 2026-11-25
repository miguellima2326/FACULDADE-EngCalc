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
import { step, n, materialsText, KG_POR_CM2_M } from "./lib/steps.js";
import { REFS_CIVIL } from "./referencias.js";

const fx = (x, d = 2) => Number(x).toFixed(d);

/* Unidades alternativas por campo (constituição §7) — o 1º item é a unidade-base */
const U_KN   = [{ value: "kN", factor: 1 }, { value: "tf", factor: 9.80665 }, { value: "kgf", factor: 0.00980665 }];
const U_KN_M = [{ value: "kN/m", factor: 1 }, { value: "tf/m", factor: 9.80665 }, { value: "kgf/m", factor: 0.00980665 }];
const U_KNM  = [{ value: "kN·m", factor: 1 }, { value: "tf·m", factor: 9.80665 }];
const U_KPA  = [{ value: "kPa", factor: 1 }, { value: "kgf/cm²", factor: 98.0665 }, { value: "MPa", factor: 1000 }];
const U_KN_M2 = [{ value: "kN/m²", factor: 1 }, { value: "kgf/m²", factor: 0.00980665 }, { value: "tf/m²", factor: 9.80665 }];
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
    { id: "gk",  label: "carga perm. gk (total)", ph: "20",  hint: "kN/m", units: U_KN_M },
    { id: "qk",  label: "carga variável qk",      ph: "15",  hint: "kN/m", units: U_KN_M },
    { id: "Mdinf", label: "Md informado (opcional — substitui fd·L²/8)", ph: "", hint: "kN·m", optional: true, units: U_KNM },
  ],
  example: { L: 6, bw: 25, h: 60, cob: 3, fck: 25, fyk: 500, gk: 20, qk: 15 },
  references: REFS_CIVIL.concreto,
  calc(v) {
    pos(v.L, "Vão L"); pos(v.bw, "bw"); pos(v.h, "h"); pos(v.cob, "Cobrimento");
    if (v.gk < 0 || v.qk < 0) throw new Error("Cargas não podem ser negativas");
    checkFck(v.fck); checkFyk(v.fyk);
    const fcd = fcdOf(v.fck), fyd = fydOf(v.fyk);
    const phiT = 0.63, phiL = 2.0; // cm (estimativa)
    const d = v.h - v.cob - phiT - phiL / 2; // cm
    if (d <= 0) throw new Error("Cobrimento incompatível com a altura");

    const fd = 1.4 * v.gk + 1.4 * v.qk;               // kN/m
    const MdInf = v.Mdinf > 0;                         // spec 006 E1: momento vindo de outro cálculo
    const Md = MdInf ? v.Mdinf : (fd * v.L * v.L) / 8; // kN·m
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

    const cmd = Md * 100;                                // kN·cm
    const steps = [
      step("fd", "Carga de cálculo", "fd = 1,4·(gk + qk)", `1,4·(${n(v.gk)} + ${n(v.qk)})`, fd, "kN/m"),
      MdInf ? step("Md", "Momento de cálculo (informado)", "Md", undefined, Md, "kN·m")
            : step("Md", "Momento de cálculo", "Md = fd·L²/8", `${n(fd)}·${n(v.L)}²/8`, Md, "kN·m"),
      step("d", "Altura útil", "d = h − c − φt − φl/2", `${n(v.h, 1)} − ${n(v.cob)} − 0,63 − 1,00`, d, "cm"),
      step("fcd", "Resistência de cálculo do concreto", "fcd = fck/1,4", `${n(v.fck, 0)}/1,4`, fcd, "MPa"),
      step("fyd", "Resistência de cálculo do aço", "fyd = fyk/1,15", `${n(v.fyk, 0)}/1,15`, fyd, "MPa"),
      step("Kmd", "Coeficiente adimensional", "Kmd = Md/(bw·d²·fcd)", `${n(cmd, 0)}/(${n(v.bw, 1)}·${n(d)}²·${n(fcd / 10, 4)})`, Kmd, "", 4),
      step("bx", "Posição relativa da linha neutra", "βx = (0,68 − √(0,4624 − 1,088·Kmd))/0,544", `(0,68 − √(0,4624 − 1,088·${n(Kmd, 4)}))/0,544`, bx, "", 4),
      step("x", "Linha neutra", "x = βx·d", `${n(bx, 4)}·${n(d)}`, bx * d, "cm"),
      step("z", "Braço de alavanca", "z = d·(1 − 0,4·βx)", `${n(d)}·(1 − 0,4·${n(bx, 4)})`, z, "cm"),
      step("As", "Armadura de flexão", "As = Md/(z·fyd)", `${n(cmd, 0)}/(${n(z)}·${n(fyd / 10, 3)})`, As, "cm²"),
      step("AsMin", "Armadura mínima", "As,mín = ρmín·bw·h", `${n(rhoMin * 100, 3)}%·${n(v.bw, 1)}·${n(v.h, 1)}`, AsMin, "cm²"),
      step("Vsd", "Cortante de cálculo no apoio", "Vsd = fd·L/2", `${n(fd)}·${n(v.L)}/2`, Vsd, "kN"),
      step("Vrd2", "Resistência da biela comprimida", "VRd2 = 0,27·αv2·fcd·bw·d", `0,27·${n(av2, 2)}·${n(fcd / 10, 4)}·${n(v.bw, 1)}·${n(d)}`, Vrd2, "kN", 1),
      step("fctd", "Resistência de cálculo à tração", "fctd = 0,7·0,3·fck^(2/3)/1,4", `0,7·0,3·${n(v.fck, 0)}^(2/3)/1,4`, fctd, "MPa", 3),
      step("Vc", "Parcela do concreto", "Vc = 0,6·fctd·bw·d", `0,6·${n(fctd / 10, 4)}·${n(v.bw, 1)}·${n(d)}`, Vc, "kN", 1),
      step("Vsw", "Parcela dos estribos", "Vsw = Vsd − Vc", `${n(Vsd)} − ${n(Vc)}`, Vsw, "kN", 1),
      step("AswS", "Estribos calculados", "Asw/s = Vsw/(0,9·d·fywd)", `${n(Vsw)}/(0,9·${n(d)}·${n(fywd / 10, 3)})·100`, AswS, "cm²/m"),
      step("AswMin", "Estribos mínimos", "Asw,mín/s = 0,2·fct,m/fywk·bw", `0,2·${n(fctm(v.fck), 3)}/${fywk}·${n(v.bw, 1)}·100`, AswMin, "cm²/m"),
    ];
    // Quantitativo: concreto, forma (fundo + 2 laterais) e aço (longitudinal + estribos de 2 ramos)
    const perimEstribo = (2 * (v.bw - 2 * v.cob) + 2 * (v.h - 2 * v.cob)) / 100;   // m
    const kgLong = AsAdot * v.L * KG_POR_CM2_M;
    const kgEstr = (AswAdot / 2) * perimEstribo * v.L * KG_POR_CM2_M;
    const materials = [
      { key: "concreto", label: `Concreto C${v.fck}`, qty: (v.bw / 100) * (v.h / 100) * v.L, unit: "m³" },
      { key: "forma", label: "Forma", qty: ((2 * v.h + v.bw) / 100) * v.L, unit: "m²" },
      { key: "aco", label: `Aço CA-${v.fyk / 10}`, qty: kgLong + kgEstr, unit: "kg" },
    ];
    return {
      steps, materials,
      val: [
        `── ESFORÇOS ──────────────────────────`,
        `fd = 1,4·${v.gk} + 1,4·${v.qk} = ${fx(fd)} kN/m`,
        MdInf ? `Md = Md,inf (informado) = ${fx(Md)} kN·m   (fd·L²/8 = ${fx((fd * v.L * v.L) / 8)} kN·m ignorado)` : `Md = fd·L²/8 = ${fx(Md)} kN·m`,
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
        `⚠ ELS (flecha e fissuração) não verificados aqui → use "Flecha de viga CA"`,
        ...materialsText(materials, `aço longitudinal ${fx(kgLong, 1)} kg + estribos ${fx(kgEstr, 1)} kg; sem perdas`),
      ].join("\n"),
      unit: "", multi: true,
      links: MdInf ? [] : [{
        label: "Verificar flecha desta viga (ELS)", area: "civil", calcId: "flecha_ca",
        values: { L: v.L, bw: v.bw, h: v.h, cob: v.cob, fck: v.fck, As: Number(fx(AsAdot)), gk: v.gk, qk: v.qk },
      }],
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
    { id: "Nk",    label: "carga normal de serviço Nk",       ph: "800", hint: "kN",   units: U_KN },
    { id: "Mk",    label: "momento de serviço Mk (dir. A)",   ph: "0",   hint: "kN·m", units: U_KNM },
    { id: "ap",    label: "dimensão do pilar a (dir. A)",     ph: "40",  hint: "cm"   },
    { id: "bp",    label: "dimensão do pilar b",              ph: "40",  hint: "cm"   },
    { id: "sigAd", label: "tensão admissível do solo σadm",   ph: "200", hint: "kPa",  units: U_KPA },
    { id: "fck",   label: "fck do concreto",                  ph: "25",  hint: "MPa"  },
    { id: "fyk",   label: "fyk do aço",                       ph: "500", hint: "MPa"  },
    { id: "cobs",  label: "cobrimento nominal",               ph: "5",   hint: "cm"   },
    { id: "hs",    label: "altura h (opcional — calcula se vazio)", ph: "", hint: "cm", optional: true },
  ],
  example: { Nk: 800, Mk: 0, ap: 40, bp: 40, sigAd: 200, fck: 25, fyk: 500, cobs: 5 },
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

    const steps = [
      step("N", "Carga no solo (serviço + peso próprio)", "N = 1,05·Nk", `1,05·${n(v.Nk, 1)}`, N, "kN", 1),
      step("area", "Área necessária", "A·B = N/σadm", `${n(N, 1)}/${n(v.sigAd, 1)}`, area, "m²", 3),
      step("B", "Lado B (balanços iguais: A − B = a − b)", "B = [−(a − b) + √((a − b)² + 4·A·B)]/2, múltiplo de 5 cm", `[−${n(dif)} + √(${n(dif)}² + 4·${n(area, 3)})]/2`, B, "m"),
      step("A", "Lado A", "A = B + (a − b), ampliado até σmáx ≤ σadm", undefined, A, "m"),
      step("e", "Excentricidade", "e = Mk/N", `${n(v.Mk)}/${n(N, 1)}`, p.e, "m", 3),
      step("sigMax", "Pressão máxima no solo", p.triangular ? "σmáx = 2N/(3B·(A/2 − e))" : "σmáx = N/(A·B)·(1 + 6e/A)", p.triangular ? undefined : `${n(N, 1)}/(${n(A)}·${n(B)})·(1 + 6·${n(p.e, 3)}/${n(A)})`, p.sigMax, "kPa"),
      step("hMin", "Altura mínima (sapata rígida)", "h ≥ (A − a)/3", `(${n(A)} − ${n(a)})/3`, (A - a) / 3, "m", 3),
      step("h", "Altura adotada", "h", undefined, h, "m"),
      step("Nd", "Carga de cálculo", "Nd = 1,4·Nk", `1,4·${n(v.Nk, 1)}`, Nd, "kN", 1),
      step("x1A", "Distância à seção S1 (dir. A)", "x₁ = (A − a)/2 + 0,15·a", `(${n(A)} − ${n(a)})/2 + 0,15·${n(a)}`, x1A, "m", 3),
      step("M1A", "Momento na seção S1 (dir. A)", "M1d = σd,máx·B·x₁²/2", `${n(pd.sigMax)}·${n(B)}·${n(x1A, 3)}²/2`, M1A, "kN·m"),
      step("AsA", "Armadura paralela a A", "As = M1d/(0,85·d·fyd)", `${n(M1A * 100, 0)}/(0,85·${n(dA, 1)}·${n(fyd / 10, 3)})`, AsA, "cm²"),
      step("M1B", "Momento na seção S1 (dir. B)", "M1d = σd,méd·A·x₁²/2", `${n(sigMed)}·${n(A)}·${n(x1B, 3)}²/2`, M1B, "kN·m"),
      step("AsB", "Armadura paralela a B", "As = M1d/(0,85·d·fyd)", `${n(M1B * 100, 0)}/(0,85·${n(dB, 1)}·${n(fyd / 10, 3)})`, AsB, "cm²"),
      step("tauSd", "Tensão na biela (contorno do pilar)", "τsd = Nd/(u₀·d)", `${n(Nd * 1e3, 0)}/(${n(u0, 0)}·${n(dMed * 10, 0)})`, tauSd, "MPa", 3),
      step("tauRd2", "Resistência da biela", "τRd2 = 0,27·αv2·fcd", `0,27·${n(alphaV2(v.fck), 2)}·${n(fcd)}`, tauRd2, "MPa", 3),
    ];
    const materials = [
      { key: "concreto", label: `Concreto C${v.fck}`, qty: A * B * h, unit: "m³" },
      { key: "forma", label: "Forma", qty: 2 * (A + B) * h, unit: "m²" },
      { key: "aco", label: `Aço CA-${v.fyk / 10}`, qty: (AsAf * A + AsBf * B) * KG_POR_CM2_M, unit: "kg" },
    ];

    return {
      steps, materials,
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
        ...materialsText(materials, "sapata como bloco retangular A×B×h; sem perdas"),
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
    { id: "Nd",   label: "força normal de cálculo Nd",    ph: "1500", hint: "kN",   units: U_KN },
    { id: "M1d",  label: "momento de 1ª ordem M1d (dir. h)", ph: "60", hint: "kN·m", units: U_KNM },
    { id: "lc",   label: "comprimento do pilar lc",       ph: "3.0",  hint: "m"    },
    { id: "beta", label: "coef. de vínculo β (biarticulado=1)", ph: "1", hint: "—"  },
    { id: "bP",   label: "dimensão b da seção",           ph: "25",   hint: "cm"   },
    { id: "hP",   label: "dimensão h da seção (dir. M1d)", ph: "50",  hint: "cm"   },
    { id: "fck",  label: "fck",                           ph: "30",   hint: "MPa"  },
    { id: "fyk",  label: "fyk",                           ph: "500",  hint: "MPa"  },
    { id: "dl",   label: "d' — centro da barra à face (opcional, padrão 4)", ph: "4", hint: "cm", optional: true },
  ],
  example: { Nd: 1500, M1d: 60, lc: 3, beta: 1, bP: 25, hP: 50, fck: 30, fyk: 500 },
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

    const steps = [
      step("le", "Comprimento de flambagem", "le = β·lc", `${n(v.beta)}·${n(v.lc)}`, le, "m"),
      step("nu", "Força normal adimensional", "ν = Nd/(Ac·fcd)", `${n(Nd, 1)}/(${n(Ac, 0)}·${n(fcd / 10, 4)})`, nu, "", 3),
      ...[dh, db].flatMap((d) => [
        step(`lambda_${d.nome}`, `Esbeltez (dir. ${d.nome})`, `λ = le·√12/${d.nome}`, `${n(le)}·3,464/${n(d.hDir / 100)}`, d.lambda, "", 1),
        step(`Mmin_${d.nome}`, `Momento mínimo (dir. ${d.nome})`, `M1d,mín = Nd·(0,015 + 0,03·${d.nome})`, `${n(Nd, 1)}·(0,015 + 0,03·${n(d.hDir / 100)})`, d.Mmin, "kN·m"),
        step(`lambda1_${d.nome}`, `Esbeltez limite (dir. ${d.nome})`, "λ1 = 25 + 12,5·e1/h  (35 ≤ λ1 ≤ 90)", `25 + 12,5·${n(d.M1d / Nd, 4)}/${n(d.hDir / 100)}`, d.lambda1, "", 1),
        ...(d.M2 > 0 ? [
          step(`invR_${d.nome}`, `Curvatura (dir. ${d.nome})`, "1/r = 0,005/(h·(ν + 0,5))", `0,005/(${n(d.hDir / 100)}·(${n(nu, 3)} + 0,5))`, d.invR, "1/m", 5),
          step(`M2_${d.nome}`, `Momento de 2ª ordem (dir. ${d.nome})`, "M2d = Nd·le²/10·(1/r)", `${n(Nd, 1)}·${n(le)}²/10·${n(d.invR, 5)}`, d.M2, "kN·m"),
        ] : []),
        step(`Mtot_${d.nome}`, `Momento total (dir. ${d.nome})`, "Md,tot = M1d + M2d", `${n(d.M1d)} + ${n(d.M2)}`, d.Mtot, "kN·m"),
        step(`As_${d.nome}`, `Armadura necessária (dir. ${d.nome})`, "As por equilíbrio da seção (flexo-compressão)", undefined, d.As, "cm²"),
      ]),
      step("AsMin", "Armadura mínima", "As,mín = máx(0,15·Nd/fyd; 0,4%·Ac)", `máx(0,15·${n(Nd, 1)}/${n(fyd / 10, 3)}; 0,004·${n(Ac, 0)})`, AsMin, "cm²"),
      step("As", "Armadura adotada", "As = máx(As,crit; As,mín)", `máx(${n(crit.As)}; ${n(AsMin)})`, As, "cm²"),
    ];
    const materials = [
      { key: "concreto", label: `Concreto C${v.fck}`, qty: (Ac / 1e4) * v.lc, unit: "m³" },
      { key: "forma", label: "Forma", qty: (2 * (v.bP + v.hP) / 100) * v.lc, unit: "m²" },
      { key: "aco", label: `Aço CA-${v.fyk / 10}`, qty: As * v.lc * KG_POR_CM2_M, unit: "kg" },
    ];

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
        ...materialsText(materials, "aço só longitudinal, sem estribos e sem perdas"),
      ].join("\n"),
      unit: "", multi: true, steps, materials,
      links: [{
        label: "Dimensionar a sapata deste pilar", area: "civil", calcId: "fundacao",
        values: { Nk: Number(fx(v.Nd / 1.4, 1)), Mk: 0, ap: v.hP, bp: v.bP, sigAd: 200, fck: 25, fyk: 500, cobs: 5 },
      }],
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
    { id: "q1", label: "vão 1 — carga distrib. q₁", ph: "25",    hint: "kN/m", units: U_KN_M },
    { id: "L2", label: "vão 2 — comprimento L₂",    ph: "5.5",   hint: "m"     },
    { id: "q2", label: "vão 2 — carga distrib. q₂", ph: "18",    hint: "kN/m", units: U_KN_M },
    { id: "EI", label: "rigidez E·I (constante)",   ph: "45000", hint: "kN·m²" },
  ],
  example: { L1: 6, q1: 10, L2: 6, q2: 10, EI: 45000 },
  calc(v) {
    pos(v.L1, "L₁"); pos(v.L2, "L₂"); pos(v.q1, "q₁"); pos(v.q2, "q₂"); pos(v.EI, "EI");
    const r = vigaContinua2Vaos(v.L1, v.q1, v.L2, v.q2, v.EI);
    const lim = (L, d) => `[L/250 = ${fx((L * 1000) / 250, 1)} ${d <= (L * 1000) / 250 ? "✓" : "✗"} | L/500 = ${fx((L * 1000) / 500, 1)} ${d <= (L * 1000) / 500 ? "✓" : "✗"}]`;
    const d1 = r.f1.d * 1000, d2 = r.f2.d * 1000;
    const steps = [
      step("MB", "Momento no apoio central (3 momentos)", "M_B = −(q₁L₁³ + q₂L₂³)/(8·(L₁ + L₂))", `−(${n(v.q1)}·${n(v.L1)}³ + ${n(v.q2)}·${n(v.L2)}³)/(8·(${n(v.L1)} + ${n(v.L2)}))`, r.MB, "kN·m"),
      step("RA", "Reação em A", "R_A = q₁L₁/2 + M_B/L₁", `${n(v.q1)}·${n(v.L1)}/2 + (${n(r.MB)})/${n(v.L1)}`, r.RA, "kN"),
      step("RC", "Reação em C", "R_C = q₂L₂/2 + M_B/L₂", `${n(v.q2)}·${n(v.L2)}/2 + (${n(r.MB)})/${n(v.L2)}`, r.RC, "kN"),
      step("RB", "Reação em B", "R_B = q₁L₁ + q₂L₂ − R_A − R_C", `${n(v.q1 * v.L1)} + ${n(v.q2 * v.L2)} − ${n(r.RA)} − ${n(r.RC)}`, r.RB, "kN"),
      step("M1", "Momento positivo máx. (vão 1)", "M⁺ = R_A²/(2q₁)", `${n(r.RA)}²/(2·${n(v.q1)})`, r.M1, "kN·m"),
      step("M2", "Momento positivo máx. (vão 2)", "M⁺ = R_C²/(2q₂)", `${n(r.RC)}²/(2·${n(v.q2)})`, r.M2, "kN·m"),
      step("d1", "Flecha máxima (vão 1)", "δ máx por superposição (q + M_B)", undefined, d1, "mm"),
      step("d2", "Flecha máxima (vão 2)", "δ máx por superposição (q + M_B)", undefined, d2, "mm"),
    ];
    return {
      steps,
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
      links: (() => {
        const v1 = v.L1 >= v.L2, Lmax = v1 ? v.L1 : v.L2, qmax = v1 ? v.q1 : v.q2;
        const base = { L: Lmax, gk: qmax, qk: 0, bw: 20, h: 50, cob: 3, fck: 25, fyk: 500 };
        return [
          { label: "Dimensionar apoio B (momento negativo)", area: "civil", calcId: "concreto", values: { ...base, Mdinf: Number(fx(1.4 * Math.abs(r.MB))) } },
          { label: "Dimensionar vão (momento positivo máx.)", area: "civil", calcId: "concreto", values: { ...base, Mdinf: Number(fx(1.4 * Math.max(r.M1, r.M2))) } },
          { label: "Sapata do apoio central", area: "civil", calcId: "fundacao", values: { Nk: Number(fx(r.RB)), Mk: 0, ap: 20, bp: 40, sigAd: 200, fck: 25, fyk: 500, cobs: 5 } },
        ];
      })(),
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
  example: { I: 150, a: 5, hT: 1.5, b: 12, nCond: 1, mat: "0.011", wC: 15, sC: 0.5, sH: 1 },
  calc(v) {
    pos(v.I, "I"); pos(v.a, "a"); pos(v.b, "b"); pos(v.wC, "Largura da calha");
    if (v.hT < 0) throw new Error("h não pode ser negativo");
    if (!(v.nCond >= 1) || !Number.isInteger(v.nCond)) throw new Error("Nº de condutores deve ser inteiro ≥ 1");
    if (!(v.sC >= 0.5)) throw new Error("Declividade da calha ≥ 0,5% (NBR 10844 §5.5.1)");
    if (!(v.sH >= 0.5)) throw new Error("Declividade do condutor horizontal ≥ 0,5% (NBR 10844 §5.7.1)");
    const nMan = Number(v.mat);
    const A = (v.a + v.hT / 2) * v.b;               // m²
    const Q = (v.I * A) / 60;                       // L/min
    const Qc = Q / v.nCond;                         // L/min por condutor / trecho de calha
    const Qm3s = Qc / 60000;
    // Calha retangular
    const w = v.wC / 100, sC = v.sC / 100;
    const y = laminaRetangular(w, Qm3s, nMan, sC);
    const Hcalha = Math.ceil(y * 2 * 100);          // cm (lâmina ≤ metade da altura)
    const Vc = vazaoRetangular(w, y, nMan, sC).V;
    // Condutor horizontal (lâmina 2/3 D)
    const sH = v.sH / 100;
    const cap = DN_PREDIAL.map((D) => ({ D, Q: vazaoCircular(D / 1000, 2 / 3, nMan, sH).Q * 60000 }));
    const horiz = cap.find((c) => c.Q >= Qc);
    // Condutor vertical
    const Dv = Math.max(75, horiz ? Math.min(horiz.D, 150) : 150);
    const steps = [
      step("A", "Área de contribuição", "A = (a + h/2)·b", `(${n(v.a)} + ${n(v.hT)}/2)·${n(v.b)}`, A, "m²"),
      step("Q", "Vazão de projeto", "Q = I·A/60", `${n(v.I, 0)}·${n(A)}/60`, Q, "L/min", 1),
      step("Qc", "Vazão por condutor", "Qc = Q/n", `${n(Q, 1)}/${v.nCond}`, Qc, "L/min", 1),
      step("y", "Lâmina na calha (Manning)", "Q = (1/n)·A·Rh^(2/3)·S^(1/2) → y", undefined, y * 100, "cm", 1),
      step("V", "Velocidade na calha", "V = Q/A_m", undefined, Vc, "m/s"),
    ];
    return {
      steps,
      val: [
        `── VAZÃO DE PROJETO ─────────────────`,
        `A = (a + h/2)·b = (${v.a} + ${v.hT}/2)·${v.b} = ${fx(A)} m²`,
        `Q = I·A/60 = ${fx(Q, 1)} L/min  (${fx(Q / 60, 2)} L/s)`,
        `Q por condutor/trecho: ${fx(Qc, 1)} L/min  (${v.nCond} condutor(es))`,
        A <= 100 ? `→ cobertura ≤ 100 m²: I = 150 mm/h é aceito pela norma` : `→ use I da Tab. 5 da NBR 10844 para a cidade e o período de retorno`,
        `── CALHA RETANGULAR (largura ${v.wC} cm, n = ${nMan}) ──`,
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
  example: { A: 2.5, C: 0.85, i: 120, L: 300, S: 0.02, nMn: 0.013, Dc: 600 },
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
    const steps = [
      step("tc", "Tempo de concentração (Kirpich)", "tc = 0,0195·L^0,77·S^−0,385", `0,0195·${n(v.L, 0)}^0,77·${n(v.S, 3)}^−0,385`, tc, "min", 1),
      step("Q", "Vazão de projeto (método racional)", "Q = C·i·A/360", `${n(v.C)}·${n(v.i, 0)}·${n(v.A)}/360`, Q, "m³/s", 4),
    ];
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
    return {
      val: lines.join("\n"), unit: "", multi: true, steps,
      links: [{ label: `Intensidade de chuva para t = tc (${fx(Math.max(tc, 5), 1)} min)`, area: "civil", calcId: "idf", values: { T: 10, t: Number(fx(Math.max(tc, 5), 1)) } }],
    };
  },
  result: "rede urbana",
};

/* ═══════════════════════ SPEC 009 — NOVOS CÁLCULOS ═══════════════════════ */

/* C1 — Intensidade de chuva (IDF): i = K·T^a / (t + b)^c  (mm/h, t em min)
 * Presets de equações publicadas — [CONFIRMAR] parâmetros na fonte original antes de projeto real. */
export const IDF_PRESETS = {
  sp:  { label: "São Paulo/SP — Wilken (1972) [CONFIRMAR]",            K: 1747.9, a: 0.181, b: 15, c: 0.89  },
  cwb: { label: "Curitiba/PR — Parigot de Souza (1959) [CONFIRMAR]",   K: 5950,   a: 0.217, b: 26, c: 1.15  },
  bsb: { label: "Brasília/DF — Novacap [CONFIRMAR]",                    K: 1574.7, a: 0.207, b: 11, c: 0.884 },
};
export const idfIntensidade = (K, a, b, c, T, t) => (K * Math.pow(T, a)) / Math.pow(t + b, c);
const dependeCustom = { id: "cidade", in: ["personalizado"] };

const idf = {
  id: "idf",
  icon: "chart",
  name: "Intensidade de Chuva — Curva IDF",
  desc: "i(T, t) pela equação intensidade-duração-frequência da cidade",
  norma: "Equações IDF locais",
  formula: "i = K·T^a / (t + b)^c  (mm/h) | h = i·t/60  (mm) | t = duração da chuva = tc da bacia",
  context:
    "A equação IDF (intensidade–duração–frequência) dá a intensidade média de chuva i para um período de retorno T e uma duração t. Em drenagem, usa-se t igual ao tempo de concentração tc da bacia (calculado na rede urbana) e T conforme a obra (microdrenagem 2–10 anos; macrodrenagem 25–100 anos; NBR 10844 predial: 1, 5 ou 25 anos). Os presets reproduzem equações publicadas para algumas capitais — os parâmetros estão marcados [CONFIRMAR] e devem ser conferidos na fonte original ou no manual de drenagem do município; para outras cidades escolha 'Personalizado' e informe K, a, b e c.",
  fields: [
    { id: "cidade", label: "Cidade / equação", type: "select", options: [
      ...Object.entries(IDF_PRESETS).map(([value, p]) => ({ value, label: p.label })),
      { value: "personalizado", label: "Personalizado (informar K, a, b, c)" },
    ] },
    { id: "K", label: "K", ph: "1747.9", hint: "—", dependsOn: dependeCustom },
    { id: "a", label: "a (expoente de T)", ph: "0.181", hint: "—", dependsOn: dependeCustom },
    { id: "b", label: "b", ph: "15", hint: "min", dependsOn: dependeCustom },
    { id: "c", label: "c (expoente de t + b)", ph: "0.89", hint: "—", dependsOn: dependeCustom },
    { id: "T", label: "período de retorno T", ph: "10", hint: "anos" },
    { id: "t", label: "duração da chuva t (≈ tc)", ph: "10", hint: "min" },
  ],
  example: { cidade: "sp", T: 10, t: 10 },
  calc(v) {
    const p = v.cidade === "personalizado" ? { label: "Personalizado", K: v.K, a: v.a, b: v.b, c: v.c } : IDF_PRESETS[v.cidade];
    if (!p) throw new Error("Cidade inválida");
    pos(p.K, "K"); pos(p.c, "c");
    if (!(p.b >= 0)) throw new Error("b deve ser ≥ 0");
    if (!(v.T >= 1)) throw new Error("T deve ser ≥ 1 ano");
    pos(v.t, "Duração t");
    const i = idfIntensidade(p.K, p.a, p.b, p.c, v.T, v.t);
    const steps = [
      step("i", "Intensidade de chuva", "i = K·T^a/(t + b)^c", `${n(p.K, 1)}·${n(v.T, 0)}^${n(p.a, 3)}/(${n(v.t, 0)} + ${n(p.b, 0)})^${n(p.c, 3)}`, i, "mm/h", 1),
      step("h", "Altura de chuva", "h = i·t/60", `${n(i, 1)}·${n(v.t, 0)}/60`, (i * v.t) / 60, "mm", 1),
    ];
    const tabela = [5, 10, 15, 30, 60, 120].map((t) => `t = ${String(t).padStart(3)} min → i = ${fx(idfIntensidade(p.K, p.a, p.b, p.c, v.T, t), 1).padStart(6)} mm/h`);
    return {
      val: [
        `── EQUAÇÃO ──────────────────────────`,
        `${p.label}`,
        `i = ${p.K}·T^${p.a} / (t + ${p.b})^${p.c}`,
        `── RESULTADO (T = ${v.T} anos, t = ${v.t} min) ──`,
        `i = ${fx(i, 1)} mm/h`,
        `altura de chuva h = i·t/60 = ${fx((i * v.t) / 60, 1)} mm`,
        `── CURVA PARA T = ${v.T} anos ───────────`,
        ...tabela,
        v.cidade !== "personalizado" ? `⚠ parâmetros do preset marcados [CONFIRMAR] — confira na fonte/manual municipal` : `→ parâmetros informados pelo usuário`,
      ].join("\n"),
      unit: "", multi: true, steps,
      links: [{ label: "Usar esta intensidade na drenagem predial", area: "civil", calcId: "tubos", values: { I: Number(fx(i, 1)), a: 5, hT: 1.5, b: 12, nCond: 1, mat: "0.011", wC: 15, sC: 0.5, sH: 1 } }],
    };
  },
  result: "intensidade de chuva",
};

/* C2 — Laje maciça retangular, carga uniforme — método de Marcus (faixas + correção de torção) */
const BORDAS = [
  { value: "AA", label: "apoio – apoio" },
  { value: "AE", label: "apoio – engaste" },
  { value: "EE", label: "engaste – engaste" },
];
/* coeficiente de flecha da faixa (δ = c·p·l⁴/EI), divisor do momento positivo m e do negativo n (X = p·l²/n) */
const FAIXA = { AA: { c: 5 / 384, m: 8, n: null }, AE: { c: 2 / 384, m: 14.22, n: 8 }, EE: { c: 1 / 384, m: 24, n: 12 } };

/** Laje por Marcus: kx = cy·ly⁴/(cx·lx⁴ + cy·ly⁴); M = k·p·l²/m·ν; ν = 1 − (20/3)·(k/m)·(l/l_outro)². [CONFIRMAR] vs. tabelas de Bares */
export function lajeMarcus(lx, ly, p, bx, by) {
  const fxS = FAIXA[bx], fyS = FAIXA[by];
  const lam = ly / lx;
  if (lam > 2) {
    return { umaDirecao: true, lam, kx: 1, ky: 0, Mx: (p * lx * lx) / fxS.m, My: 0, Xx: fxS.n ? (p * lx * lx) / fxS.n : 0, Xy: 0 };
  }
  const kx = (fyS.c * ly ** 4) / (fxS.c * lx ** 4 + fyS.c * ly ** 4), ky = 1 - kx;
  const nux = 1 - (20 / 3) * (kx / fxS.m) * (lx / ly) ** 2;
  const nuy = 1 - (20 / 3) * (ky / fyS.m) * (ly / lx) ** 2;
  return {
    umaDirecao: false, lam, kx, ky, nux, nuy,
    Mx: ((kx * p * lx * lx) / fxS.m) * nux,
    My: ((ky * p * ly * ly) / fyS.m) * nuy,
    Xx: fxS.n ? (kx * p * lx * lx) / fxS.n : 0,
    Xy: fyS.n ? (ky * p * ly * ly) / fyS.n : 0,
  };
}

/** Armadura por metro (cm²/m) para Md (kN·m/m) e d (cm). null se Kmd > limite. */
function asPorMetro(Md, d, fck, fyk) {
  if (Md <= 0) return 0;
  const fcd = fcdOf(fck), fyd = fydOf(fyk);
  const Kmd = (Md * 1e6) / (1000 * (d * 10) ** 2 * fcd);
  if (Kmd > KMD_LIM) return null;
  const z = d * (1 - 0.4 * bxDeKmd(Kmd));
  return (Md * 1e6) / (z * 10 * fyd) / 100;
}

const HMIN_LAJE = { piso: 8, cobertura: 7, balanco: 10, veiculo: 10, veiculo_pesado: 12 }; // cm — NBR 6118 §13.2.4.1

const laje = {
  id: "laje",
  icon: "concrete",
  name: "Laje Maciça — Momentos e Armadura (NBR 6118)",
  desc: "momentos por Marcus, armadura por metro, ρmín de laje e espaçamento",
  norma: "NBR 6118 §13.2.4 · §19.3",
  formula:
    "p = 1,4·(25·h + g_rev + q) | kx = cy·ly⁴/(cx·lx⁴ + cy·ly⁴) | ν = 1 − (20/3)·(k/m)·(lx/ly)² | " +
    "M = k·p·l²/m·ν | X = k·p·l²/n | As = Md/(z·fyd) por metro | ρ⁺ ≥ 0,67·ρmín ; ρ⁻ ≥ ρmín | s ≤ mín(2h; 20 cm)",
  context:
    "Laje maciça retangular com carga uniforme. lx é o MENOR vão e ly o maior; para cada direção escolha a vinculação das duas bordas que a cortam (apoio ou engaste). Se ly/lx > 2 a laje é armada em uma direção (faixa de 1 m como viga). Caso contrário, os momentos vêm do método de Marcus — divisão da carga entre as faixas pela igualdade de flechas no centro e redução pela rigidez à torção. É um método simplificado clássico; as tabelas de Bares/Czerny (teoria das placas, ν = 0,2) dão valores um pouco diferentes [CONFIRMAR]. Peso próprio 25 kN/m³ automático. Armadura mínima da Tab. 19.1 (positiva em laje armada em 2 direções: 0,67·ρmín; negativa: ρmín) e espaçamento máximo de §20.1. Espessura mínima de §13.2.4.1.",
  fields: [
    { id: "lx", label: "menor vão lx", ph: "4.0", hint: "m" },
    { id: "ly", label: "maior vão ly", ph: "5.0", hint: "m" },
    { id: "bx", label: "Bordas que cortam lx (direção x)", type: "select", options: BORDAS },
    { id: "by", label: "Bordas que cortam ly (direção y)", type: "select", options: BORDAS },
    { id: "h", label: "espessura h", ph: "10", hint: "cm" },
    { id: "grev", label: "revestimento + alvenaria g", ph: "1.0", hint: "kN/m²", units: U_KN_M2 },
    { id: "q", label: "carga variável q", ph: "2.0", hint: "kN/m²", units: U_KN_M2 },
    { id: "uso", label: "Uso da laje", type: "select", options: [
      { value: "piso", label: "Piso (não em balanço) — h ≥ 8 cm" },
      { value: "cobertura", label: "Cobertura (não em balanço) — h ≥ 7 cm" },
      { value: "balanco", label: "Em balanço — h ≥ 10 cm" },
      { value: "veiculo", label: "Veículos ≤ 30 kN — h ≥ 10 cm" },
      { value: "veiculo_pesado", label: "Veículos > 30 kN — h ≥ 12 cm" },
    ] },
    { id: "fck", label: "fck", ph: "25", hint: "MPa" },
    { id: "fyk", label: "fyk", ph: "500", hint: "MPa" },
    { id: "cob", label: "cobrimento", ph: "2.5", hint: "cm" },
  ],
  example: { lx: 4, ly: 5, bx: "AA", by: "AA", h: 10, grev: 1, q: 2, uso: "piso", fck: 25, fyk: 500, cob: 2.5 },
  calc(v) {
    pos(v.lx, "lx"); pos(v.ly, "ly"); pos(v.h, "h"); pos(v.cob, "Cobrimento");
    if (v.ly < v.lx) throw new Error("lx deve ser o MENOR vão (troque lx e ly e as vinculações)");
    if (v.grev < 0 || v.q < 0) throw new Error("Cargas não podem ser negativas");
    checkFck(v.fck); checkFyk(v.fyk);
    const hmin = HMIN_LAJE[v.uso];
    const g = 25 * (v.h / 100) + v.grev;             // kN/m²
    const pk = g + v.q, pd = 1.4 * pk;
    const r = lajeMarcus(v.lx, v.ly, pd, v.bx, v.by);
    const phi = 1.0;                                 // cm (φ10 estimado)
    const dx = v.h - v.cob - phi / 2, dy = dx - phi;
    if (dy <= 0) throw new Error("Espessura insuficiente para o cobrimento");
    const rhoMin = rhoMinFlexao(v.fck);
    const AsMinPos = (r.umaDirecao ? 1 : 0.67) * rhoMin * 100 * v.h;
    const AsMinNeg = rhoMin * 100 * v.h;
    const sMax = Math.min(2 * v.h, 20);
    const phiMax = (v.h * 10) / 8;
    const bitolas = [5, 6.3, 8, 10, 12.5].filter((b) => b <= phiMax);
    const arm = (nome, Md, d, min) => {
      const As = asPorMetro(Md, d, v.fck, v.fyk);
      if (As === null) return [`${nome}: Md = ${fx(Md)} kN·m/m → ✗ Kmd acima do limite — aumente h`];
      const Af = Math.max(As, min);
      const op = sugerirEspacamento(Af, bitolas, 7, sMax);
      return [`${nome}: Md = ${fx(Md)} kN·m/m → As = ${fx(As)} cm²/m ${As < min ? `(mín ${fx(min)})` : ""} → ${op.length ? op.slice(0, 2).map((o) => `φ${o.phi} c/ ${o.s}`).join(" | ") : "⚠ revisar bitola"}`];
    };
    const AsX = asPorMetro(r.Mx, dx, v.fck, v.fyk), AsY = r.umaDirecao ? null : asPorMetro(r.My, dy, v.fck, v.fyk);
    const steps = [
      step("g", "Carga permanente", "g = 25·h + g_rev", `25·${n(v.h / 100)} + ${n(v.grev)}`, g, "kN/m²"),
      step("pd", "Carga de cálculo", "pd = 1,4·(g + q)", `1,4·(${n(g)} + ${n(v.q)})`, pd, "kN/m²"),
      step("lam", "Relação entre vãos", "λ = ly/lx", `${n(v.ly)}/${n(v.lx)}`, r.lam, "", 3),
      ...(r.umaDirecao ? [] : [
        step("kx", "Parcela da carga na direção x", "kx = cy·ly⁴/(cx·lx⁴ + cy·ly⁴)", undefined, r.kx, "", 3),
        step("nux", "Correção de torção (x)", "νx = 1 − (20/3)·(kx/mx)·(lx/ly)²", undefined, r.nux, "", 3),
        step("nuy", "Correção de torção (y)", "νy = 1 − (20/3)·(ky/my)·(ly/lx)²", undefined, r.nuy, "", 3),
      ]),
      step("Mx", "Momento positivo x", r.umaDirecao ? "Mx = pd·lx²/m" : "Mx = kx·pd·lx²/mx·νx", undefined, r.Mx, "kN·m/m"),
      ...(r.umaDirecao ? [] : [step("My", "Momento positivo y", "My = ky·pd·ly²/my·νy", undefined, r.My, "kN·m/m")]),
      step("dx", "Altura útil x", "dx = h − c − φ/2", `${n(v.h, 1)} − ${n(v.cob)} − 0,5`, dx, "cm"),
      ...(AsX !== null ? [step("AsX", "Armadura positiva x", "As = Md/(z·fyd) por metro", undefined, AsX, "cm²/m")] : []),
      ...(AsY !== null && AsY !== undefined ? [step("AsY", "Armadura positiva y", "As = Md/(z·fyd) por metro", undefined, AsY, "cm²/m")] : []),
      step("AsMinPos", "Armadura positiva mínima", r.umaDirecao ? "As,mín = ρmín·100·h" : "As,mín = 0,67·ρmín·100·h", undefined, AsMinPos, "cm²/m"),
    ];
    const kgX = Math.max(AsX ?? 0, AsMinPos) * v.ly * v.lx * KG_POR_CM2_M;
    const kgY = (r.umaDirecao ? 0 : Math.max(AsY ?? 0, AsMinPos)) * v.lx * v.ly * KG_POR_CM2_M;
    const materials = [
      { key: "concreto", label: `Concreto C${v.fck}`, qty: v.lx * v.ly * (v.h / 100), unit: "m³" },
      { key: "forma", label: "Forma", qty: v.lx * v.ly, unit: "m²" },
      { key: "aco", label: `Aço CA-${v.fyk / 10}`, qty: kgX + kgY, unit: "kg" },
    ];
    const secDist = r.umaDirecao ? Math.max(0.2 * Math.max(asPorMetro(r.Mx, dx, v.fck, v.fyk) ?? 0, AsMinPos), 0.5 * rhoMin * 100 * v.h, 0.9) : 0;
    return {
      val: [
        `── GEOMETRIA ────────────────────────`,
        `λ = ly/lx = ${fx(r.lam, 3)} → ${r.umaDirecao ? "armada em UMA direção (λ > 2)" : "armada em DUAS direções"}`,
        v.h >= hmin ? `✓ h = ${v.h} cm ≥ h,mín = ${hmin} cm (§13.2.4.1)` : `✗ h = ${v.h} cm < h,mín = ${hmin} cm (§13.2.4.1)`,
        `── CARGAS ───────────────────────────`,
        `g = 25·h + g_rev = ${fx(g)} kN/m²   q = ${fx(v.q)} kN/m²`,
        `pd = 1,4·(g + q) = ${fx(pd)} kN/m²`,
        `── MOMENTOS DE CÁLCULO (Marcus) ─────`,
        r.umaDirecao ? `faixa de 1 m na direção x` : `kx = ${fx(r.kx, 3)}  ky = ${fx(r.ky, 3)}   νx = ${fx(r.nux, 3)}  νy = ${fx(r.nuy, 3)}`,
        `Mx = ${fx(r.Mx)}   My = ${fx(r.My)}   kN·m/m (positivos)`,
        `X'x = ${fx(r.Xx)}  X'y = ${fx(r.Xy)}  kN·m/m (negativos, nos engastes)`,
        `── ARMADURAS (por metro) ────────────`,
        `dx = ${fx(dx, 1)} cm   dy = ${fx(dy, 1)} cm   s,máx = ${fx(sMax, 0)} cm   φ ≤ h/8 = ${fx(phiMax, 1)} mm`,
        ...arm("Positiva x", r.Mx, dx, AsMinPos),
        ...(r.umaDirecao
          ? [`Distribuição y: As ≥ ${fx(secDist)} cm²/m (20% da principal; ≥ 0,9 cm²/m) → ${sugerirEspacamento(secDist, bitolas, 7, 33).slice(0, 1).map((o) => `φ${o.phi} c/ ${o.s}`).join("") || "⚠ revisar"}`]
          : arm("Positiva y", r.My, dy, AsMinPos)),
        ...(r.Xx > 0 ? arm("Negativa x", r.Xx, dx, AsMinNeg) : []),
        ...(r.Xy > 0 ? arm("Negativa y", r.Xy, dx, AsMinNeg) : []),
        `⚠ coeficientes pelo método de Marcus — compare com as tabelas de Bares [CONFIRMAR]; flecha da laje não verificada`,
        ...materialsText(materials, "aço só das armaduras positivas, sem negativas e sem perdas"),
      ].join("\n"),
      unit: "", multi: true, steps, materials,
    };
  },
  result: "laje maciça",
};

/* C3 — Flecha de viga CA biapoiada (ELS-DEF) — NBR 6118 §17.3.2.1 */
/** ξ(t) — §17.3.2.1.2 (t em meses) */
export const xiFluencia = (t) => (t > 70 ? 2 : 0.68 * Math.pow(0.996, t) * Math.pow(t, 0.32));

export function flechaVigaCA({ L, bw, h, cob, fck, As, Asl = 0, gk, qk, psi2 = 0.3, t0 = 1 }) {
  const Eci = 5600 * Math.sqrt(fck);                     // MPa (αE = 1, granito)
  const ai = Math.min(0.8 + (0.2 * fck) / 80, 1);
  const Ecs = ai * Eci;                                  // MPa
  const d = h - cob - 0.63 - 1.0, dl = cob + 0.63 + 0.5;  // cm
  const Ic = (bw * h ** 3) / 12;                         // cm⁴
  const fct = fctm(fck);                                 // MPa
  const Mr = (1.5 * fct * (Ic * 1e4)) / ((h / 2) * 10) / 1e6; // kN·m  (α = 1,5 retangular)
  const ae = ES / Ecs;
  // Estádio II: bw/2·x² + αe(As + As')·x − αe(As·d + As'·d') = 0
  const A = bw / 2, B = ae * (As + Asl), C = -ae * (As * d + Asl * dl);
  const x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  const III = (bw * x ** 3) / 3 + ae * As * (d - x) ** 2 + ae * Asl * (x - dl) ** 2; // cm⁴
  const pqp = gk + psi2 * qk;                            // kN/m
  const Ma = (pqp * L * L) / 8;                          // kN·m
  const r3 = Ma > 0 ? Math.min(Mr / Ma, 1) ** 3 : 1;
  const Ieq = Math.min(r3 * Ic + (1 - r3) * III, Ic);    // cm⁴
  const EI = Ecs * 1e3 * Ieq * 1e-8;                     // kN·m²  (MPa→kN/m² ×1e3; cm⁴→m⁴ ×1e-8)
  const d0 = (5 * pqp * L ** 4) / (384 * EI) * 1000;     // mm
  const rhol = Asl / (bw * d);
  const af = (xiFluencia(71) - xiFluencia(t0)) / (1 + 50 * rhol);
  const dt = d0 * (1 + af);
  return { Eci, Ecs, d, Ic, Mr, ae, x, III, pqp, Ma, Ieq, EI, d0, af, dt, lim: (L * 1000) / 250 };
}

const flechaCA = {
  id: "flecha_ca",
  icon: "deflect",
  name: "Flecha de Viga CA — Branson + Fluência (NBR 6118)",
  desc: "inércia equivalente, flecha imediata e diferida × L/250",
  norma: "NBR 6118 §17.3.2.1",
  formula:
    "Ecs = αi·5600·√fck | Mr = 1,5·fct,m·Ic/yt | Estádio II: bw·x²/2 = αe·As·(d − x) | " +
    "Ieq = (Mr/Ma)³·Ic + [1 − (Mr/Ma)³]·III | pqp = g + ψ2·q | δ0 = 5·pqp·L⁴/(384·Ecs·Ieq) | " +
    "αf = Δξ/(1 + 50ρ') | δ∞ = δ0·(1 + αf) ≤ L/250",
  context:
    "Verificação do estado-limite de deformação excessiva de viga biapoiada de concreto armado. A rigidez é a inércia equivalente de Branson entre o estádio I (seção bruta Ic) e o estádio II (seção fissurada III), usando o momento de fissuração Mr (α = 1,5 para seção retangular) e o momento da combinação quase permanente Ma = (g + ψ2·q)·L²/8 (ψ2 = 0,3 para edifícios residenciais; 0,4 comerciais; 0,6 bibliotecas/garagens). A flecha diferida no tempo multiplica a imediata por αf = Δξ/(1 + 50ρ'), com ξ(t) da norma (t0 = idade de aplicação da carga, em meses). Limite visual: L/250. Use a armadura As adotada no dimensionamento (o cálculo de Viga CA traz um link para cá).",
  fields: [
    { id: "L", label: "vão L", ph: "6.0", hint: "m" },
    { id: "bw", label: "largura bw", ph: "25", hint: "cm" },
    { id: "h", label: "altura h", ph: "60", hint: "cm" },
    { id: "cob", label: "cobrimento", ph: "3.0", hint: "cm" },
    { id: "fck", label: "fck", ph: "25", hint: "MPa" },
    { id: "As", label: "armadura tracionada As (adotada)", ph: "10.25", hint: "cm²" },
    { id: "Asl", label: "armadura comprimida As' (opcional)", ph: "", hint: "cm²", optional: true },
    { id: "gk", label: "carga permanente gk", ph: "20", hint: "kN/m", units: U_KN_M },
    { id: "qk", label: "carga variável qk", ph: "15", hint: "kN/m", units: U_KN_M },
    { id: "psi2", label: "ψ2 (opcional, padrão 0,3)", ph: "0.3", hint: "—", optional: true },
    { id: "t0", label: "idade ao carregar t0 (opcional, padrão 1)", ph: "1", hint: "meses", optional: true },
  ],
  example: { L: 6, bw: 25, h: 60, cob: 3, fck: 25, As: 10.25, gk: 20, qk: 15 },
  calc(v) {
    pos(v.L, "L"); pos(v.bw, "bw"); pos(v.h, "h"); pos(v.As, "As"); pos(v.cob, "Cobrimento");
    checkFck(v.fck);
    if (v.gk < 0 || v.qk < 0) throw new Error("Cargas não podem ser negativas");
    const psi2 = v.psi2 > 0 ? v.psi2 : 0.3, t0 = v.t0 > 0 ? v.t0 : 1;
    if (psi2 > 1) throw new Error("ψ2 deve estar entre 0 e 1");
    const r = flechaVigaCA({ L: v.L, bw: v.bw, h: v.h, cob: v.cob, fck: v.fck, As: v.As, Asl: v.Asl > 0 ? v.Asl : 0, gk: v.gk, qk: v.qk, psi2, t0 });
    const steps = [
      step("Ecs", "Módulo de elasticidade secante", "Ecs = αi·5600·√fck", `${n(Math.min(0.8 + (0.2 * v.fck) / 80, 1), 4)}·5600·√${n(v.fck, 0)}`, r.Ecs, "MPa", 0),
      step("Ic", "Inércia da seção bruta", "Ic = bw·h³/12", `${n(v.bw, 1)}·${n(v.h, 1)}³/12`, r.Ic, "cm⁴", 0),
      step("Mr", "Momento de fissuração", "Mr = 1,5·fct,m·Ic/yt", `1,5·${n(fctm(v.fck), 3)}·${n(r.Ic, 0)}/${n(v.h / 2, 1)}`, r.Mr, "kN·m"),
      step("ae", "Relação entre módulos", "αe = Es/Ecs", `210000/${n(r.Ecs, 0)}`, r.ae, "", 3),
      step("x", "Linha neutra no estádio II", "bw·x²/2 = αe·As·(d − x)", undefined, r.x, "cm"),
      step("III", "Inércia no estádio II", "I_II = bw·x³/3 + αe·As·(d − x)²", undefined, r.III, "cm⁴", 0),
      step("pqp", "Carga quase permanente", "pqp = g + ψ2·q", `${n(v.gk)} + ${n(psi2)}·${n(v.qk)}`, r.pqp, "kN/m"),
      step("Ma", "Momento atuante", "Ma = pqp·L²/8", `${n(r.pqp)}·${n(v.L)}²/8`, r.Ma, "kN·m"),
      step("Ieq", "Inércia equivalente (Branson)", "Ieq = (Mr/Ma)³·Ic + [1 − (Mr/Ma)³]·I_II", undefined, r.Ieq, "cm⁴", 0),
      step("d0", "Flecha imediata", "δ0 = 5·pqp·L⁴/(384·E·I)", `5·${n(r.pqp)}·${n(v.L)}⁴/(384·${n(r.EI, 0)})·1000`, r.d0, "mm"),
      step("af", "Coeficiente de fluência", "αf = Δξ/(1 + 50ρ')", undefined, r.af, "", 3),
      step("dt", "Flecha total", "δ∞ = δ0·(1 + αf)", `${n(r.d0)}·(1 + ${n(r.af, 3)})`, r.dt, "mm"),
      step("lim", "Limite visual", "δlim = L/250", `${n(v.L * 1000, 0)}/250`, r.lim, "mm", 1),
    ];
    return {
      steps,
      val: [
        `── MATERIAL E SEÇÃO ─────────────────`,
        `Ecs = ${fx(r.Ecs, 0)} MPa   αe = Es/Ecs = ${fx(r.ae, 2)}   d = ${fx(r.d, 1)} cm`,
        `Ic = ${fx(r.Ic, 0)} cm⁴   Mr = ${fx(r.Mr)} kN·m`,
        `── ESTÁDIO II ───────────────────────`,
        `x_II = ${fx(r.x, 2)} cm   I_II = ${fx(r.III, 0)} cm⁴`,
        `── COMBINAÇÃO QUASE PERMANENTE ──────`,
        `pqp = g + ψ2·q = ${fx(v.gk)} + ${psi2}·${fx(v.qk)} = ${fx(r.pqp)} kN/m`,
        `Ma = pqp·L²/8 = ${fx(r.Ma)} kN·m  ${r.Ma > r.Mr ? "(fissurada: Ma > Mr)" : "(não fissurada: Ma ≤ Mr)"}`,
        `Ieq (Branson) = ${fx(r.Ieq, 0)} cm⁴   E·I = ${fx(r.EI, 0)} kN·m²`,
        `── FLECHAS ──────────────────────────`,
        `δ0 (imediata) = ${fx(r.d0)} mm`,
        `αf = Δξ/(1 + 50ρ') = ${fx(r.af, 3)}   (t0 = ${t0} mês)`,
        `δ∞ (total) = δ0·(1 + αf) = ${fx(r.dt)} mm`,
        r.dt <= r.lim ? `✓ δ∞ ≤ L/250 = ${fx(r.lim, 1)} mm` : `✗ δ∞ > L/250 = ${fx(r.lim, 1)} mm — aumentar h, As' ou contraflecha (≤ L/350)`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "flecha CA",
};

/* C4 — Ancoragem e emenda por traspasse — NBR 6118 §9.4 / §9.5.2 */
const ETA1 = { nervurada: 2.25, entalhada: 1.4, lisa: 1.0 };
const ALFA0T = { "20": 1.2, "25": 1.4, "33": 1.6, "50": 1.8, "100": 2.0 };

export function ancoragem({ phi, fck, fyk, barra = "nervurada", boa = true, AsCalc = undefined, AsEf = undefined, gancho = false, emendadas = "50" }) {
  const n1 = ETA1[barra], n2 = boa ? 1 : 0.7, n3 = phi < 32 ? 1 : (132 - phi) / 100;
  const fbd = n1 * n2 * n3 * fctdOf(fck);           // MPa
  const fyd = fydOf(fyk);
  const lb = Math.max((phi / 4) * (fyd / fbd), 25 * phi); // mm
  const alfa = gancho ? 0.7 : 1;
  const ratio = AsCalc > 0 && AsEf > 0 ? AsCalc / AsEf : 1;
  const lbmin = Math.max(0.3 * lb, 10 * phi, 100);
  const lbnec = Math.max(alfa * lb * ratio, lbmin);
  const a0t = ALFA0T[emendadas];
  const l0tmin = Math.max(0.3 * a0t * lb, 15 * phi, 200);
  const l0t = Math.max(a0t * lbnec, l0tmin);
  return { n1, n2, n3, fbd, fyd, lb, alfa, ratio, lbmin, lbnec, a0t, l0t, l0tmin };
}

const ancoragemCalc = {
  id: "ancoragem",
  icon: "beam",
  name: "Ancoragem e Emenda por Traspasse (NBR 6118)",
  desc: "comprimento de ancoragem básico/necessário e emenda de barras tracionadas",
  norma: "NBR 6118 §9.4 · §9.5.2",
  formula:
    "fbd = η1·η2·η3·fctd | lb = (φ/4)·(fyd/fbd) ≥ 25φ | lb,nec = α·lb·As,calc/As,ef ≥ máx(0,3lb; 10φ; 100 mm) | " +
    "l0t = α0t·lb,nec ≥ máx(0,3·α0t·lb; 15φ; 200 mm)",
  context:
    "Calcula quanto uma barra precisa 'entrar' no concreto para transferir sua força (ancoragem) e o comprimento de sobreposição de duas barras tracionadas (emenda por traspasse). A resistência de aderência fbd depende da superfície da barra (η1: nervurada CA-50 = 2,25; entalhada CA-60 = 1,4; lisa CA-25 = 1,0), da zona de aderência (η2: boa = 1,0; má = 0,7 — barras horizontais na parte superior de peças altas) e do diâmetro (η3). Ganchos na extremidade permitem α = 0,7 (com cobrimento ≥ 3φ). O coeficiente α0t cresce com a porcentagem de barras emendadas na mesma seção.",
  fields: [
    { id: "phi", label: "diâmetro da barra φ", ph: "16", hint: "mm" },
    { id: "fck", label: "fck", ph: "25", hint: "MPa" },
    { id: "fyk", label: "fyk", ph: "500", hint: "MPa" },
    { id: "barra", label: "Superfície da barra (η1)", type: "select", options: [
      { value: "nervurada", label: "Nervurada — CA-50 (η1 = 2,25)" },
      { value: "entalhada", label: "Entalhada — CA-60 (η1 = 1,4)" },
      { value: "lisa", label: "Lisa — CA-25 (η1 = 1,0)" },
    ] },
    { id: "aderencia", label: "Zona de aderência (η2)", type: "select", options: [
      { value: "boa", label: "Boa aderência (η2 = 1,0)" },
      { value: "ma", label: "Má aderência (η2 = 0,7)" },
    ] },
    { id: "gancho", label: "Extremidade", type: "select", options: [
      { value: "reta", label: "Reta (α = 1,0)" },
      { value: "gancho", label: "Com gancho (α = 0,7)" },
    ] },
    { id: "AsCalc", label: "As calculada (opcional)", ph: "", hint: "cm²", optional: true },
    { id: "AsEf", label: "As efetiva (opcional)", ph: "", hint: "cm²", optional: true },
    { id: "emendadas", label: "Barras emendadas na mesma seção", type: "select", options: [
      { value: "20", label: "≤ 20% (α0t = 1,2)" }, { value: "25", label: "25% (α0t = 1,4)" },
      { value: "33", label: "33% (α0t = 1,6)" }, { value: "50", label: "50% (α0t = 1,8)" },
      { value: "100", label: "> 50% (α0t = 2,0)" },
    ] },
  ],
  example: { phi: 16, fck: 25, fyk: 500, barra: "nervurada", aderencia: "boa", gancho: "reta", emendadas: "50" },
  references: REFS_CIVIL.ancoragem,
  calc(v) {
    pos(v.phi, "φ"); checkFck(v.fck); checkFyk(v.fyk);
    if ((v.AsCalc > 0) !== (v.AsEf > 0)) throw new Error("Informe As calculada e As efetiva juntas (ou nenhuma)");
    if (v.AsCalc > v.AsEf) throw new Error("As calculada não pode ser maior que a efetiva");
    const r = ancoragem({ phi: v.phi, fck: v.fck, fyk: v.fyk, barra: v.barra, boa: v.aderencia === "boa", AsCalc: v.AsCalc, AsEf: v.AsEf, gancho: v.gancho === "gancho", emendadas: v.emendadas });
    const cm = (mm) => `${fx(mm / 10, 1)} cm (${fx(mm / v.phi, 1)}φ)`;
    const lbCalc = (v.phi / 4) * (r.fyd / r.fbd);
    const steps = [
      step("fctd", "Resistência de cálculo à tração", "fctd = 0,7·0,3·fck^(2/3)/1,4", `0,7·0,3·${n(v.fck, 0)}^(2/3)/1,4`, fctdOf(v.fck), "MPa", 3),
      step("fbd", "Resistência de aderência", "fbd = η1·η2·η3·fctd", `${n(r.n1)}·${n(r.n2, 1)}·${n(r.n3)}·${n(fctdOf(v.fck), 3)}`, r.fbd, "MPa", 3),
      step("fyd", "Resistência de cálculo do aço", "fyd = fyk/1,15", `${n(v.fyk, 0)}/1,15`, r.fyd, "MPa"),
      step("lb", "Comprimento de ancoragem básico", "lb = (φ/4)·(fyd/fbd) ≥ 25φ", `(${n(v.phi / 10, 2)}/4)·(${n(r.fyd)}/${n(r.fbd, 3)})${lbCalc < 25 * v.phi ? " → 25φ" : ""}`, r.lb / 10, "cm"),
      step("lbmin", "Comprimento mínimo", "lb,mín = máx(0,3·lb; 10φ; 10 cm)", undefined, r.lbmin / 10, "cm"),
      step("lbnec", "Comprimento necessário", "lb,nec = α·lb·As,calc/As,ef ≥ lb,mín", `${n(r.alfa, 1)}·${n(r.lb / 10)}·${n(r.ratio, 3)}`, r.lbnec / 10, "cm"),
      step("l0t", "Emenda por traspasse", "l0t = α0t·lb,nec ≥ l0t,mín", `${n(r.a0t, 1)}·${n(r.lbnec / 10)}`, r.l0t / 10, "cm"),
    ];
    return {
      steps,
      val: [
        `── ADERÊNCIA ────────────────────────`,
        `η1 = ${r.n1}   η2 = ${r.n2}   η3 = ${fx(r.n3, 2)}   fctd = ${fx(fctdOf(v.fck), 3)} MPa`,
        `fbd = η1·η2·η3·fctd = ${fx(r.fbd, 3)} MPa`,
        `── ANCORAGEM ────────────────────────`,
        `lb = (φ/4)·(fyd/fbd) = ${cm(r.lb)}  (fyd = ${fx(r.fyd)} MPa; ≥ 25φ)`,
        `α = ${r.alfa}   As,calc/As,ef = ${fx(r.ratio, 3)}`,
        `lb,mín = máx(0,3lb; 10φ; 100 mm) = ${cm(r.lbmin)}`,
        `lb,nec = ${cm(r.lbnec)}`,
        `── EMENDA POR TRASPASSE (tração) ────`,
        `α0t = ${r.a0t}   l0t,mín = ${cm(r.l0tmin)}`,
        `l0t = α0t·lb,nec = ${cm(r.l0t)}`,
        v.phi > 32 ? `✗ φ > 32 mm: emenda por traspasse não permitida (§9.5.2)` : `✓ traspasse permitido para φ ≤ 32 mm`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "ancoragem",
};

/* C5 — Consumo de materiais */
const TAXA_ACO = { viga: 100, pilar: 120, laje: 80, sapata: 60 }; // kg/m³ — valores típicos [aproximados]
const DENS = { cimento: 3.15, areia: 2.65, brita: 2.70 };         // kg/dm³ (massa específica)
const MASSA_UNIT = { areia: 1.5, brita: 1.4 };                     // t/m³ (massa unitária solta) [aproximada]

/** Consumo de cimento (kg/m³) para traço 1:a:p em massa e fator a/c: C = 1000/(1/γc + a/γa + p/γp + a/c) */
export const consumoCimento = (a, p, ac) => 1000 / (1 / DENS.cimento + a / DENS.areia + p / DENS.brita + ac);

const materiais = {
  id: "materiais",
  icon: "concrete",
  name: "Consumo de Materiais — Concreto, Forma e Aço",
  desc: "volume, forma, aço por taxa e cimento/areia/brita pelo traço",
  norma: "Estimativa de quantitativos",
  formula:
    "V = n·c·b·h | Forma: viga (2h + b)·c · pilar 2(b + h)·c · laje c·b + 2(c + b)·h · sapata 2(c + b)·h | " +
    "Aço = taxa·V | C = 1000/(1/3,15 + a/2,65 + p/2,70 + a/c) | areia = a·C ; brita = p·C ; água = (a/c)·C",
  context:
    "Levantamento rápido de quantitativos de um elemento de concreto armado (repetido n vezes). Volume de concreto, área de forma (faces em contato com o concreto) e peso de aço por taxa típica (kg de aço por m³ de concreto — valores aproximados por elemento, substitua pelo do projeto quando houver). Consumo de cimento pelo método do volume absoluto com traço em massa 1 : a : p e fator água/cimento, usando massas específicas usuais; areia e brita em kg e em m³ (massa unitária solta aproximada). Não inclui perdas — acrescente 5 a 10% para compra.",
  fields: [
    { id: "elem", label: "Elemento", type: "select", options: [
      { value: "viga", label: "Viga" }, { value: "pilar", label: "Pilar" }, { value: "laje", label: "Laje" }, { value: "sapata", label: "Sapata" },
    ] },
    { id: "c", label: "comprimento c (vão / altura do pilar / lado)", ph: "6.0", hint: "m" },
    { id: "b", label: "largura b", ph: "20", hint: "cm" },
    { id: "h", label: "altura / espessura h", ph: "50", hint: "cm" },
    { id: "n", label: "quantidade de elementos", ph: "1", hint: "un" },
    { id: "taxa", label: "taxa de aço (opcional — típica se vazio)", ph: "", hint: "kg/m³", optional: true },
    { id: "a", label: "traço — areia (a)", ph: "2", hint: "kg/kg cim." },
    { id: "p", label: "traço — brita (p)", ph: "3", hint: "kg/kg cim." },
    { id: "ac", label: "fator água/cimento", ph: "0.55", hint: "—" },
  ],
  example: { elem: "viga", c: 6, b: 20, h: 50, n: 1, a: 2, p: 3, ac: 0.55 },
  calc(v) {
    pos(v.c, "c"); pos(v.b, "b"); pos(v.h, "h"); pos(v.ac, "a/c");
    if (!(v.n >= 1) || !Number.isInteger(v.n)) throw new Error("Quantidade deve ser inteira ≥ 1");
    if (v.a < 0 || v.p < 0) throw new Error("Traço inválido");
    const b = v.b / 100, h = v.h / 100;
    const V = v.n * v.c * b * h;
    const forma1 = { viga: (2 * h + b) * v.c, pilar: 2 * (b + h) * v.c, laje: v.c * b + 2 * (v.c + b) * h, sapata: 2 * (v.c + b) * h }[v.elem];
    const forma = forma1 * v.n;
    const taxa = v.taxa > 0 ? v.taxa : TAXA_ACO[v.elem];
    const aco = taxa * V;
    const C = consumoCimento(v.a, v.p, v.ac);
    const cim = C * V, areia = v.a * C * V, brita = v.p * C * V, agua = v.ac * C * V;
    const steps = [
      step("V", "Volume de concreto", "V = n·c·b·h", `${v.n}·${n(v.c)}·${n(b)}·${n(h)}`, V, "m³", 3),
      step("forma", "Área de forma", { viga: "(2h + b)·c·n", pilar: "2(b + h)·c·n", laje: "[c·b + 2(c + b)·h]·n", sapata: "2(c + b)·h·n" }[v.elem], undefined, forma, "m²"),
      step("aco", "Aço por taxa", "Aço = taxa·V", `${n(taxa, 0)}·${n(V, 3)}`, aco, "kg", 1),
      step("C", "Consumo de cimento", "C = 1000/(1/3,15 + a/2,65 + p/2,70 + a/c)", `1000/(1/3,15 + ${n(v.a)}/2,65 + ${n(v.p)}/2,70 + ${n(v.ac)})`, C, "kg/m³", 1),
      step("cim", "Cimento", "cimento = C·V", `${n(C, 1)}·${n(V, 3)}`, cim, "kg", 1),
      step("areia", "Areia", "areia = a·C·V", `${n(v.a)}·${n(C, 1)}·${n(V, 3)}`, areia, "kg", 1),
      step("brita", "Brita", "brita = p·C·V", `${n(v.p)}·${n(C, 1)}·${n(V, 3)}`, brita, "kg", 1),
      step("agua", "Água", "água = (a/c)·C·V", `${n(v.ac)}·${n(C, 1)}·${n(V, 3)}`, agua, "L", 1),
    ];
    const materials = [
      { key: "cimento", label: "Cimento (saco 50 kg)", qty: cim / 50, unit: "sacos" },
      { key: "areia", label: "Areia", qty: areia / 1000 / MASSA_UNIT.areia, unit: "m³" },
      { key: "brita", label: "Brita", qty: brita / 1000 / MASSA_UNIT.brita, unit: "m³" },
      { key: "forma", label: "Forma", qty: forma, unit: "m²" },
      { key: "aco", label: "Aço CA-50", qty: aco, unit: "kg" },
    ];
    return {
      steps, materials,
      val: [
        `── CONCRETO ─────────────────────────`,
        `V = ${v.n}·${v.c}·${fx(b)}·${fx(h)} = ${fx(V, 3)} m³`,
        `── FORMA ────────────────────────────`,
        `Área de forma = ${fx(forma, 2)} m²`,
        `── AÇO ──────────────────────────────`,
        `taxa = ${taxa} kg/m³ ${v.taxa > 0 ? "(informada)" : "(típica — aproximada)"} → ${fx(aco, 1)} kg`,
        `── TRAÇO 1 : ${v.a} : ${v.p}  (a/c = ${v.ac}) ──`,
        `consumo de cimento C = ${fx(C, 1)} kg/m³`,
        `cimento: ${fx(cim, 1)} kg (${fx(cim / 50, 1)} sacos de 50 kg)`,
        `areia:   ${fx(areia, 1)} kg (≈ ${fx(areia / 1000 / MASSA_UNIT.areia, 3)} m³)`,
        `brita:   ${fx(brita, 1)} kg (≈ ${fx(brita / 1000 / MASSA_UNIT.brita, 3)} m³)`,
        `água:    ${fx(agua, 1)} L`,
        `⚠ sem perdas — acrescente 5–10% para compra; massas unitárias aproximadas`,
        ...materialsText(materials, "concreto feito na obra; sem perdas"),
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "materiais",
};

export const CIVIL = {
  label: "Civil",
  icon: "foundation",
  calcs: [vigaCA, sapata, drenagemPredial, redeUrbana, pilar, vigaContinua, idf, laje, flechaCA, ancoragemCalc, materiais],
};
