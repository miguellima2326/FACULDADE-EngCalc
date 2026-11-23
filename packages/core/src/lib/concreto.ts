/**
 * Concreto armado — NBR 6118:2023 (concretos do grupo I, C20–C50).
 * Unidades internas: N, mm, MPa (= N/mm²).
 */
import { bisect, interp } from "./math.js";

export const GAMMA_C = 1.4;
export const GAMMA_S = 1.15;
export const ES = 210000; // MPa — §8.3.5

export function checkFck(fck: number) {
  if (!(fck >= 20)) throw new Error("fck mínimo: 20 MPa (NBR 6118 §8.2.1)");
  if (fck > 50) throw new Error("Este módulo cobre concretos do grupo I (C20 a C50) — fck ≤ 50 MPa");
}

export function checkFyk(fyk: number) {
  if (![250, 500, 600].includes(fyk)) throw new Error("fyk deve ser 250 (CA-25), 500 (CA-50) ou 600 (CA-60) MPa");
}

export const fcd = (fck: number) => fck / GAMMA_C;
export const fyd = (fyk: number) => fyk / GAMMA_S;

/** Resistência média à tração — §8.2.5: fct,m = 0,3·fck^(2/3) (fck ≤ 50). */
export const fctm = (fck: number) => 0.3 * Math.pow(fck, 2 / 3);
/** fctd = fctk,inf/γc = 0,7·fct,m/1,4 */
export const fctd = (fck: number) => (0.7 * fctm(fck)) / GAMMA_C;

/** αv2 = 1 − fck/250 — §17.4.2.2 */
export const alphaV2 = (fck: number) => 1 - fck / 250;

/** Taxa mínima de armadura de flexão — Tab. 17.3 (seção retangular, CA-50), em fração de Ac = b·h. */
export const TAB_17_3: ReadonlyArray<readonly [number, number]> = [
  [20, 0.0015], [25, 0.0015], [30, 0.0015], [35, 0.00164], [40, 0.00179], [45, 0.00194], [50, 0.00208],
];
export const rhoMinFlexao = (fck: number) => interp(TAB_17_3, fck);

/** Limite de ductilidade — §14.6.4.3: x/d ≤ 0,45 (fck ≤ 50). */
export const BX_LIM = 0.45;

/** Kmd = Md/(b·d²·fcd) = 0,68·βx − 0,272·βx²  (bloco retangular 0,8x · 0,85fcd). */
export const kmdDeBx = (bx: number) => 0.68 * bx - 0.272 * bx * bx;
export const KMD_LIM = kmdDeBx(BX_LIM); // 0,2509

/** βx = (0,68 − √(0,68² − 4·0,272·Kmd)) / (2·0,272) */
export const bxDeKmd = (kmd: number) => (0.68 - Math.sqrt(0.68 * 0.68 - 4 * 0.272 * kmd)) / (2 * 0.272);

/** Barras comerciais (mm → cm²). */
export const BARRAS = [5, 6.3, 8, 10, 12.5, 16, 20, 25, 32].map((phi) => ({ phi, area: (Math.PI * phi * phi) / 400 }));
export const areaBarra = (phi: number) => (Math.PI * phi * phi) / 400; // cm²

/**
 * Sugere φ e espaçamento para uma armadura em cm²/m (lajes, sapatas, estribos por metro).
 * Retorna a primeira bitola que resulta em sMin ≤ s ≤ sMax.
 */
export function sugerirEspacamento(asPorMetro: number, bitolas: number[], sMin: number, sMax: number) {
  const out: Array<{ phi: number; s: number }> = [];
  for (const phi of bitolas) {
    const s = Math.floor(((areaBarra(phi) / asPorMetro) * 100) * 2) / 2; // cm, arredondado para baixo a 0,5 cm
    const sAdot = Math.min(s, sMax);
    if (sAdot >= sMin) out.push({ phi, s: sAdot });
  }
  return out;
}

/* ═══════════ Flexo-compressão normal — seção retangular, armadura simétrica ═══════════
 * Domínios de deformação (§17.2.2): εcu = 3,5‰, εc2 = 2‰, εsu = 10‰.
 * Concreto: bloco retangular 0,85·fcd em 0,8x (limitado a h).
 * Armadura: As/2 a d' de cada face. Compressão positiva.
 */
export interface SecaoRet { b: number; h: number; dl: number; fcd: number; fyd: number; }

function deformacao(s: SecaoRet, x: number) {
  const d = s.h - s.dl;
  let k: number; // curvatura (1/mm), ε(y) = k·(x − y), y medido da face mais comprimida
  if (x <= 0.259 * d) k = 0.010 / (d - x);            // domínio 2 (pivô A: aço 10‰)
  else if (x <= s.h) k = 0.0035 / x;                   // domínios 3, 4, 4a (pivô B: 3,5‰)
  else k = 0.002 / (x - (3 / 7) * s.h);                // domínio 5 (pivô C: 2‰ a 3h/7)
  return (y: number) => k * (x - y);
}

const tensaoAco = (eps: number, s: SecaoRet) => Math.max(-s.fyd, Math.min(s.fyd, ES * eps));

/** Esforços resistentes (N em N, M em N·mm, em relação ao centro da seção) para x e As (mm²). */
export function esforcosResistentes(s: SecaoRet, x: number, As: number) {
  const eps = deformacao(s, x);
  const yb = Math.min(0.8 * x, s.h);
  const Fc = 0.85 * s.fcd * s.b * yb;
  const Mc = Fc * (s.h / 2 - yb / 2);
  const ss1 = tensaoAco(eps(s.dl), s);          // armadura próxima da face comprimida
  const ss2 = tensaoAco(eps(s.h - s.dl), s);    // armadura oposta
  const N = Fc + (As / 2) * (ss1 + ss2);
  const M = Mc + (As / 2) * (ss1 - ss2) * (s.h / 2 - s.dl);
  return { N, M, ss1, ss2, Fc };
}

/** Momento resistente para Nd dado e As dado. null se Nd excede a capacidade da seção. */
export function momentoResistente(s: SecaoRet, Nd: number, As: number) {
  const xMin = 1e-6 * s.h, xMax = 1e4 * s.h;
  const g = (x: number) => esforcosResistentes(s, x, As).N - Nd;
  if (g(xMax) < 0) return null;            // compressão maior que a capacidade
  if (g(xMin) > 0) return null;            // tração maior que a capacidade
  const x = bisect(g, xMin, xMax, 1e-6);
  return { x, ...esforcosResistentes(s, x, As) };
}

/**
 * Armadura total simétrica (mm²) para (Nd, Md). Bisseção em As: menor As com MRd ≥ Md.
 * Retorna null se nem As = AsMax resolve.
 */
export function armaduraFlexoCompressao(s: SecaoRet, Nd: number, Md: number, AsMax: number) {
  const ok = (As: number) => { const r = momentoResistente(s, Nd, As); return r !== null && r.M >= Md; };
  if (ok(0)) return { As: 0, ...momentoResistente(s, Nd, 0)! };
  if (!ok(AsMax)) return null;
  let lo = 0, hi = AsMax;
  for (let i = 0; i < 100 && hi - lo > 0.01; i++) { const m = (lo + hi) / 2; if (ok(m)) hi = m; else lo = m; }
  return { As: hi, ...momentoResistente(s, Nd, hi)! };
}
