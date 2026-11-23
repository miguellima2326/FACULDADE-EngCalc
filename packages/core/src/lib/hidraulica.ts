/**
 * Hidráulica de condutos — Manning e seção circular parcialmente cheia (geometria exata).
 */
import { bisect } from "./math.js";

export interface SecaoParcial { theta: number; area: number; perimetro: number; Rh: number; }

/** Geometria da seção circular com lâmina y (D e y na mesma unidade). θ = 2·acos(1 − 2y/D). */
export function secaoCircularParcial(D: number, y: number): SecaoParcial {
  const r = Math.min(Math.max(y / D, 0), 1);
  const theta = 2 * Math.acos(1 - 2 * r);
  const area = (D * D / 8) * (theta - Math.sin(theta));
  const perimetro = (D * theta) / 2;
  return { theta, area, perimetro, Rh: perimetro > 0 ? area / perimetro : 0 };
}

/** Manning (SI): Q = (1/n)·A·Rh^(2/3)·S^(1/2) — m³/s, com A em m², Rh em m. */
export const manningQ = (area: number, Rh: number, n: number, S: number) => (area / n) * Math.pow(Rh, 2 / 3) * Math.sqrt(S);

/** Vazão em conduto circular com lâmina relativa yD (0–1). */
export function vazaoCircular(D: number, yD: number, n: number, S: number) {
  const s = secaoCircularParcial(D, yD * D);
  const Q = manningQ(s.area, s.Rh, n, S);
  return { Q, V: s.area > 0 ? Q / s.area : 0, ...s };
}

/** Diâmetro p/ seção plena: D = (4^(5/3)·n·Q / (π·√S))^(3/8). */
export const diametroSecaoPlena = (Q: number, n: number, S: number) =>
  Math.pow((Math.pow(4, 5 / 3) * n * Q) / (Math.PI * Math.sqrt(S)), 3 / 8);

/**
 * Lâmina relativa y/D que escoa a vazão Q (D fixo). A curva Q(y/D) cresce até y/D ≈ 0,938
 * (Q máx ≈ 1,076·Q_plena) — busca só nesse ramo. Retorna null se Q > Q máx.
 */
export function laminaParaVazao(D: number, Q: number, n: number, S: number): number | null {
  const Y_QMAX = 0.9382;
  if (Q <= 0) return 0;
  if (vazaoCircular(D, Y_QMAX, n, S).Q < Q) return null;
  return bisect((yD) => vazaoCircular(D, yD, n, S).Q - Q, 1e-6, Y_QMAX, 1e-9);
}

/** Calha retangular de largura b e lâmina y (m). */
export function vazaoRetangular(b: number, y: number, n: number, S: number) {
  const area = b * y, perimetro = b + 2 * y, Rh = area / perimetro;
  const Q = manningQ(area, Rh, n, S);
  return { Q, V: Q / area, area, perimetro, Rh };
}

/** Lâmina y (m) na calha retangular para a vazão Q (m³/s). */
export function laminaRetangular(b: number, Q: number, n: number, S: number): number {
  let hi = 0.05;
  while (vazaoRetangular(b, hi, n, S).Q < Q && hi < 100) hi *= 2;
  return bisect((y) => vazaoRetangular(b, y, n, S).Q - Q, 1e-6, hi, 1e-9);
}

/** Tempo de concentração de Kirpich: tc (min) = 0,0195·L^0,77·S^−0,385 (L em m, S em m/m). */
export const kirpich = (L: number, S: number) => 0.0195 * Math.pow(L, 0.77) * Math.pow(S, -0.385);
