// @ts-nocheck
/**
 * EngCalc — motor de dados (ícones + cálculos)
 * v2.0 — memória de cálculo técnica
 */

"use strict";
import { CIVIL } from "./civil.js";
import { ELETRICA } from "./eletrica.js";

/* ═══════════════════════════════════════════════════
   ÍCONES SVG
═══════════════════════════════════════════════════ */
export const CABLE_CATALOG = [
  {
    id: "memorial-240-cu", fabricante: "Projeto / memorial",
    modelo: "Cabo unipolar Cu 0,6/1 kV — 240 mm²", material: "Cobre",
    isolacao: "Conforme memorial", tensao: "0,6/1 kV", secao: 240,
    diametroCondutor: null, diametroExterno: null, temperaturaCondutor: null,
    izPorReferencia: { leito_bandeja: 607 },
    fonte: "MC-5250.00-5144-700-ORD-203=0.xls"
  },
  {
    id: "memorial-185-cu", fabricante: "Projeto / memorial",
    modelo: "Cabo unipolar Cu 0,6/1 kV — 185 mm²", material: "Cobre",
    isolacao: "Conforme memorial", tensao: "0,6/1 kV", secao: 185,
    diametroCondutor: null, diametroExterno: null, temperaturaCondutor: null,
    izPorReferencia: { leito_bandeja: 510 },
    fonte: "MC-5250.00-5144-700-ORD-203=0.xls / MC-887A-79-21651_R0.doc"
  },
  {
    id: "prysmian-ref-xlpe-cu-185", fabricante: "Prysmian / referência NBR 5410",
    modelo: "EPR/XLPE Cu — 185 mm² — enterrado", material: "Cobre",
    isolacao: "EPR/HEPR/XLPE", tensao: "0,6/1 kV", secao: 185,
    diametroCondutor: null, diametroExterno: null, temperaturaCondutor: 90,
    izPorReferencia: { enterrado_direto: 304, enterrado_duto: 304 },
    fonte: "Guia Prysmian BT Rev.10 — Tabela 8, método D, 3 condutores carregados"
  },
  {
    id: "prysmian-ref-xlpe-cu-240", fabricante: "Prysmian / referência NBR 5410",
    modelo: "EPR/XLPE Cu — 240 mm² — enterrado", material: "Cobre",
    isolacao: "EPR/HEPR/XLPE", tensao: "0,6/1 kV", secao: 240,
    diametroCondutor: null, diametroExterno: null, temperaturaCondutor: 90,
    izPorReferencia: { enterrado_direto: 351, enterrado_duto: 351 },
    fonte: "Guia Prysmian BT Rev.10 — Tabela 8, método D, 3 condutores carregados"
  },
  {
    id: "prysmian-ref-xlpe-cu-300", fabricante: "Prysmian / referência NBR 5410",
    modelo: "EPR/XLPE Cu — 300 mm² — enterrado", material: "Cobre",
    isolacao: "EPR/HEPR/XLPE", tensao: "0,6/1 kV", secao: 300,
    diametroCondutor: null, diametroExterno: null, temperaturaCondutor: 90,
    izPorReferencia: { enterrado_direto: 396, enterrado_duto: 396 },
    fonte: "Guia Prysmian BT Rev.10 — Tabela 8, método D, 3 condutores carregados"
  },
  {
    id: "nexans-hepr-pvc-cu-240", fabricante: "Nexans",
    modelo: "HEPR-PVC 0,6/1 kV 1x240 mm²", material: "Cobre",
    isolacao: "HEPR / PVC ST2", tensao: "0,6/1 kV", secao: 240,
    diametroCondutor: 19.76, diametroExterno: 27, temperaturaCondutor: 90,
    izPorReferencia: { A1: 424, A2: 386, B1: 546, B2: 462, C: 599, D: 419, E: 641, F: 679 },
    fonte: "https://www.nexans.com.br/pt/products/Construction/Insulated-copper-cables-for-low-voltage/Standard.cables.for.general.use/Nexans-HEP37553/product~ID540476285~.html"
  },
  {
    id: "nexans-xlpe-pvc-al-240", fabricante: "Nexans",
    modelo: "XLPE-PVC 0,6/1 kV 1x240 mm²", material: "Alumínio",
    isolacao: "XLPE / PVC", tensao: "0,6/1 kV", secao: 240,
    diametroCondutor: 18.4, diametroExterno: 55, temperaturaCondutor: 90,
    izPorReferencia: {},
    fonte: "https://www.nexans.com.br/pt/products/Transmission.and.Distribution/InsulatedAluminiumCablesForLowVoltage/XLPE.InsulatedCables/PVC.covere75298.html"
  },
  {
    id: "memorial-mt-4160-cu-185", nivel: "MT", fabricante: "Projeto / memorial",
    modelo: "Cabo unipolar Cu 4,16 kV — 185 mm²", material: "Cobre",
    isolacao: "EPR", tensao: "4,16 kV", tensaoMin: 3600, tensaoMax: 5000,
    secao: 185, diametroCondutor: null, diametroExterno: null, temperaturaCondutor: 90,
    izPorReferencia: { mt: 510 },
    fonte: "MC-5250.00-5144-700-ORD-203=0.xls / MC-887A-79-21651_R0.doc"
  }
];

export const ICONS = {
  tool:     `<svg viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  cpu:      `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="15" x2="4" y2="15"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="15" x2="22" y2="15"/></svg>`,
  rotate:   `<svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`,
  arrow:    `<svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
  circle:   `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>`,
  screw:    `<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  triangle: `<svg viewBox="0 0 24 24"><polygon points="12 2 22 22 2 22"/></svg>`,
  bolt:     `<svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  temp:     `<svg viewBox="0 0 24 24"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`,
  sigma:    `<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="6" y2="20"/><line x1="6" y1="4" x2="18" y2="4"/><polyline points="6 4 6 12 18 12"/></svg>`,
  binary:   `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="4" height="18" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  hash:     `<svg viewBox="0 0 24 24"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>`,
  chart:    `<svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  network:  `<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="19" r="3"/><circle cx="19" cy="19" r="3"/><line x1="12" y1="8" x2="5" y2="16"/><line x1="12" y1="8" x2="19" y2="16"/></svg>`,
  db:       `<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>`,
  wifi:     `<svg viewBox="0 0 24 24"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="20" r="1"/></svg>`,
  photo:    `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  play:     `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,

  /* Civil */
  concrete: `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  foundation:`<svg viewBox="0 0 24 24"><line x1="2" y1="20" x2="22" y2="20"/><polyline points="4 20 4 10 12 4 20 10 20 20"/><line x1="9" y1="20" x2="9" y2="13"/><line x1="15" y1="20" x2="15" y2="13"/><line x1="9" y1="13" x2="15" y2="13"/></svg>`,
  pipe:     `<svg viewBox="0 0 24 24"><line x1="12" y1="2" x2="12" y2="22"/><path d="M12 2a5 5 0 0 1 0 10 5 5 0 0 0 0 10"/><circle cx="12" cy="2" r="2"/><circle cx="12" cy="22" r="2"/></svg>`,
  beam:     `<svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="4" rx="1"/><line x1="6" y1="12" x2="4" y2="18"/><line x1="18" y1="12" x2="20" y2="18"/><line x1="12" y1="12" x2="12" y2="20"/></svg>`,
  deflect:  `<svg viewBox="0 0 24 24"><line x1="3" y1="8" x2="21" y2="8"/><path d="M3 8 Q12 18 21 8" fill="none"/><line x1="12" y1="13" x2="12" y2="18"/><polyline points="10 16 12 18 14 16"/><line x1="3" y1="6" x2="3" y2="10"/><line x1="21" y1="6" x2="21" y2="10"/></svg>`,

  /* Elétrica */
  transformer:`<svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>`,
  cable:    `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="8.2" r="1.9"/><circle cx="8.6" cy="14" r="1.9"/><circle cx="15.4" cy="14" r="1.9"/></svg>`,
  spark:    `<svg viewBox="0 0 24 24"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/><line x1="2" y1="21" x2="6" y2="17"/><line x1="18" y1="7" x2="22" y2="3"/></svg>`,
};

/* ═══════════════════════════════════════════════════
   DADOS DOS CÁLCULOS
   Cada cálculo tem: context (explicação), fields com hint (unidade inline)
═══════════════════════════════════════════════════ */
export const DATA = {

  /* ── MECÂNICA ── */
  mecanica: {
    label: "Mecânica",
    icon: "tool",
    calcs: [
      {
        id: "rpm",
        icon: "rotate",
        name: "Cálculo de RPM",
        desc: "velocidade de corte × diâmetro",
        formula: "RPM = (1000 × Vc) / (π × D)",
        context: "Determina a rotação ideal de uma ferramenta de corte (fresa, broca, torno) a partir da velocidade de corte recomendada pelo fabricante e o diâmetro da ferramenta. Essencial para programação CNC e setup de máquinas-ferramenta.",
        fields: [
          { id: "vc", label: "Vc — velocidade de corte", ph: "80", hint: "m/min" },
          { id: "d",  label: "D — diâmetro da ferramenta", ph: "50", hint: "mm" },
        ],
        calc(v) {
          if (v.d <= 0) throw new Error("Diâmetro deve ser maior que zero");
          return { val: ((1000 * v.vc) / (Math.PI * v.d)).toFixed(1), unit: "rpm" };
        },
        result: "RPM",
      },
      {
        id: "conv",
        icon: "arrow",
        name: "Conversão mm → pol",
        desc: "milímetros para polegadas e fração",
        formula: "1 in = 25,4 mm",
        context: "Converte medidas métricas para o sistema imperial, com representação em fração decimal usada em ferramentas e peças importadas. Útil em manutenção industrial e projetos com componentes americanos.",
        fields: [{ id: "mm", label: "valor em milímetros", ph: "25.4", hint: "mm" }],
        calc(v) {
          const inches = v.mm / 25.4;
          const FRACS = [
            [1,64],[1,32],[3,64],[1,16],[5,64],[3,32],[7,64],[1,8],
            [9,64],[5,32],[11,64],[3,16],[13,64],[7,32],[15,64],[1,4],
            [17,64],[9,32],[19,64],[5,16],[21,64],[11,32],[23,64],[3,8],
            [25,64],[13,32],[27,64],[7,16],[29,64],[15,32],[31,64],[1,2],
            [33,64],[17,32],[35,64],[9,16],[37,64],[19,32],[39,64],[5,8],
            [41,64],[21,32],[43,64],[11,16],[45,64],[23,32],[47,64],[3,4],
            [49,64],[25,32],[51,64],[13,16],[53,64],[27,32],[55,64],[7,8],
            [57,64],[29,32],[59,64],[15,16],[61,64],[31,32],[63,64],[1,1],
          ];
          if (v.mm < 0) throw new Error("Informe um valor ≥ 0");
          let whole = Math.floor(inches);
          const frac  = inches - whole;
          let bestFrac = [0, 64], bestDiff = frac;
          for (const [n, d] of FRACS) {
            const diff = Math.abs(n / d - frac);
            if (diff < bestDiff) { bestDiff = diff; bestFrac = [n, d]; }
          }
          // fração arredondada para 1/1 → soma 1 à parte inteira
          if (bestFrac[0] === bestFrac[1]) { whole += 1; bestFrac = [0, 64]; }
          const fracPart = bestFrac[0] === 0 ? "" : `${bestFrac[0]}/${bestFrac[1]}`;
          const fracStr = frac < 0.001 ? "" : ` (≈ ${[whole > 0 || !fracPart ? whole : "", fracPart].filter(Boolean).join(" ")}")`;
          return { val: inches.toFixed(4) + " in" + fracStr, unit: "" };
        },
        result: "polegadas",
      },
      {
        id: "polia",
        icon: "circle",
        name: "Relação de polias",
        desc: "N2 pela relação de diâmetros",
        formula: "N2 = (D1 × N1) / D2",
        context: "Calcula a rotação de saída de um sistema de transmissão por polias e correias. Usado para adequar a velocidade de motores a máquinas como compressores, bombas e ventiladores.",
        fields: [
          { id: "d1", label: "D1 — diâmetro da polia motriz", ph: "100", hint: "mm" },
          { id: "n1", label: "N1 — rotação do motor", ph: "1200", hint: "rpm" },
          { id: "d2", label: "D2 — diâmetro da polia movida", ph: "200", hint: "mm" },
        ],
        calc(v) {
          if (v.d2 <= 0) throw new Error("D2 deve ser > 0");
          return { val: ((v.d1 * v.n1) / v.d2).toFixed(1), unit: "rpm" };
        },
        result: "N2",
      },
      {
        id: "avanco",
        icon: "screw",
        name: "Avanço de roscas",
        desc: "passo × número de entradas",
        formula: "Avanço = Passo × Nº entradas",
        context: "Determina o avanço axial por volta em sistemas de parafuso/porca. Fundamental em projetos de fixação, roscas de movimento (trapezoidais, acme) e programação de tornos CNC.",
        fields: [
          { id: "p", label: "passo", ph: "1.5", hint: "mm" },
          { id: "e", label: "nº de entradas", ph: "2", hint: "entradas" },
        ],
        calc(v) {
          return { val: (v.p * v.e).toFixed(3), unit: "mm/volta" };
        },
        result: "avanço",
      },
      {
        id: "cone",
        icon: "triangle",
        name: "Ângulo de cones",
        desc: "torneamento cônico — ângulo de inclinação",
        formula: "α = arctan((D1 − D2) / (2 × L))",
        context: "Calcula o ângulo de inclinação para torneamento de peças cônicas. Usado para regulagem do carro superior do torno ou para programação de interpolação linear em CNC.",
        fields: [
          { id: "d1c", label: "D1 — diâmetro maior", ph: "60", hint: "mm" },
          { id: "d2c", label: "D2 — diâmetro menor", ph: "40", hint: "mm" },
          { id: "lc",  label: "L — comprimento do cone", ph: "100", hint: "mm" },
        ],
        calc(v) {
          if (v.lc <= 0) throw new Error("Comprimento L deve ser > 0");
          return {
            val: (Math.atan((v.d1c - v.d2c) / (2 * v.lc)) * (180 / Math.PI)).toFixed(4),
            unit: "°",
          };
        },
        result: "ângulo α",
      },
      {
        id: "tensao",
        icon: "sigma",
        name: "Tensão normal",
        desc: "tensão de tração ou compressão na seção",
        formula: "σ = F / A",
        context: "Calcula a tensão normal em elementos estruturais submetidos a tração ou compressão. Compare o resultado com o limite de escoamento do material (ex: aço SAE 1045: ~310 MPa) para verificar segurança.",
        fields: [
          { id: "f", label: "força F aplicada", ph: "5000", hint: "N" },
          { id: "a", label: "área A da seção transversal", ph: "100", hint: "mm²" },
        ],
        calc(v) {
          if (v.a <= 0) throw new Error("Área deve ser > 0");
          return { val: (v.f / v.a).toFixed(3), unit: "MPa" };
        },
        result: "σ (tensão)",
      },
      {
        id: "potencia",
        icon: "bolt",
        name: "Potência mecânica",
        desc: "potência de eixo por torque e rotação",
        formula: "P = T × ω  |  ω = 2π × n / 60  |  1 cv = 735,5 W",
        context: "Calcula a potência mecânica transmitida por um eixo em rotação. Use para dimensionar motores, redutores e verificar se a transmissão suporta a carga aplicada.",
        fields: [
          { id: "t", label: "torque T no eixo", ph: "50", hint: "N·m" },
          { id: "n", label: "rotação n", ph: "1450", hint: "rpm" },
        ],
        calc(v) {
          const P = v.t * 2 * Math.PI * v.n / 60;
          return { val: `${P.toFixed(2)} W  =  ${(P / 1000).toFixed(3)} kW  =  ${(P / 735.5).toFixed(2)} cv`, unit: "" };
        },
        result: "potência P",
      },
      {
        id: "dilatacao",
        icon: "temp",
        name: "Dilatação térmica linear",
        desc: "variação de comprimento por temperatura",
        formula: "ΔL = α × L₀ × ΔT",
        context: "Calcula quanto uma peça se dilata com a variação de temperatura. Indispensável em projetos de trilhos, tubulações, eixos e montagens com ajuste de interferência.",
        fields: [
          { id: "al", label: "coef. de dilatação α (×10⁻⁶)", ph: "12", hint: "/°C" },
          { id: "l0", label: "comprimento inicial L₀", ph: "1000", hint: "mm" },
          { id: "dt", label: "variação de temperatura ΔT", ph: "80", hint: "°C" },
        ],
        calc(v) {
          return { val: ((v.al * 1e-6) * v.l0 * v.dt).toFixed(4), unit: "mm" };
        },
        result: "ΔL",
      },
    ],
  },

  civil: CIVIL,

  eletrica: ELETRICA,
};

/* ═══════════════════════════════════════════════════
   v2 — DIAGRAMAS DO PROBLEMA + SELOS DE NORMA
   Anexado ao motor sem alterar as fórmulas originais.
═══════════════════════════════════════════════════ */
(function augment() {
  const find = (area, id) => (DATA[area] && DATA[area].calcs.find(c => c.id === id)) || null;
  const set = (area, id, props) => { const c = find(area, id); if (c) Object.assign(c, props); };

  /* — Selos de norma (onde há norma real aplicável) — */

  /* — Diagramas (SVG técnico, herda cor via currentColor) — */

  // RPM — ferramenta em rotação, diâmetro D, Vc tangencial
  set("mecanica", "rpm", { diagram: `
    <svg viewBox="0 0 300 132" class="dg" role="img" aria-label="Ferramenta de corte em rotação">
      <line class="dg-cl" x1="150" y1="14" x2="150" y2="120"/>
      <circle class="dg-line" cx="150" cy="66" r="40"/>
      <circle class="dg-fill" cx="150" cy="66" r="3"/>
      <line class="dg-dim" x1="110" y1="66" x2="190" y2="66"/>
      <path class="dg-dim" d="M110 61 L110 71 M190 61 L190 71"/>
      <text class="dg-t" x="146" y="60" text-anchor="end">D</text>
      <path class="dg-line" d="M150 26 A 40 40 0 0 1 190 66" fill="none"/>
      <path class="dg-line" d="M184 60 L190 66 L184 72" fill="none"/>
      <text class="dg-t" x="214" y="52">n (rpm)</text>
      <line class="dg-acc" x1="150" y1="26" x2="228" y2="26"/>
      <path class="dg-acc" d="M222 22 L228 26 L222 30" fill="none"/>
      <text class="dg-t-acc" x="186" y="20">Vc</text>
    </svg>` });

  // Viga CA — viga biapoiada com carga distribuída + seção transversal
  set("civil", "concreto", { diagram: `
    <svg viewBox="0 0 320 138" class="dg" role="img" aria-label="Viga biapoiada e seção">
      <g class="dg-acc">
        <line x1="42" y1="34" x2="212" y2="34"/>
        <line x1="52"  y1="34" x2="52"  y2="60"/><path d="M48 54 L52 60 L56 54" fill="none"/>
        <line x1="92"  y1="34" x2="92"  y2="60"/><path d="M88 54 L92 60 L96 54" fill="none"/>
        <line x1="132" y1="34" x2="132" y2="60"/><path d="M128 54 L132 60 L136 54" fill="none"/>
        <line x1="172" y1="34" x2="172" y2="60"/><path d="M168 54 L172 60 L176 54" fill="none"/>
        <line x1="202" y1="34" x2="202" y2="60"/><path d="M198 54 L202 60 L206 54" fill="none"/>
      </g>
      <text class="dg-t-acc" x="127" y="28" text-anchor="middle">q (gk + qk)</text>
      <line class="dg-strong" x1="42" y1="66" x2="212" y2="66"/>
      <path class="dg-line" d="M42 66 l-9 15 l18 0 z"/>
      <path class="dg-line" d="M212 66 l-9 15 l18 0 z"/>
      <line class="dg-cl" x1="20" y1="88" x2="234" y2="88"/>
      <line class="dg-dim" x1="42" y1="102" x2="212" y2="102"/>
      <path class="dg-dim" d="M42 97 L42 107 M212 97 L212 107"/>
      <text class="dg-t" x="127" y="118" text-anchor="middle">L (vão livre)</text>
      <rect class="dg-line" x="258" y="40" width="38" height="58"/>
      <circle class="dg-fill" cx="266" cy="90" r="2.6"/>
      <circle class="dg-fill" cx="277" cy="90" r="2.6"/>
      <circle class="dg-fill" cx="288" cy="90" r="2.6"/>
      <text class="dg-t" x="277" y="34" text-anchor="middle">bw</text>
      <text class="dg-t" x="304" y="72">h</text>
    </svg>` });

})();
