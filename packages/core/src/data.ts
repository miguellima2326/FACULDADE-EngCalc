// @ts-nocheck
/**
 * EngCalc — motor de dados (ícones + cálculos)
 * v2.0 — memória de cálculo técnica
 */

"use strict";
import { CIVIL } from "./civil.js";
import { ELETRICA } from "./eletrica.js";
import { MECANICA } from "./mecanica.js";

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

  mecanica: MECANICA,

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
