/** Utilitários numéricos compartilhados pelos cálculos. */

export type Table = ReadonlyArray<readonly [number, number]>;

/** Interpolação linear em tabela [x, y] ordenada por x (satura nas pontas). */
export function interp(table: Table, x: number): number {
  const first = table[0]!, last = table[table.length - 1]!;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < table.length - 1; i++) {
    const [x0, y0] = table[i]!, [x1, y1] = table[i + 1]!;
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

/** Degrau tabelado: maior chave ≤ x (tabelas discretas, sem interpolação). */
export function step(table: Table, x: number): number {
  let val = table[0]![1];
  for (const [k, f] of table) if (x >= k) val = f;
  return val;
}

/** Bisseção: encontra x em [a, b] com f(x) = 0 (f(a) e f(b) com sinais opostos). */
export function bisect(f: (x: number) => number, a: number, b: number, tol = 1e-10, maxIter = 200): number {
  let fa = f(a);
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (Math.abs(b - a) < tol || fm === 0) return m;
    if ((fa < 0) === (fm < 0)) { a = m; fa = fm; } else { b = m; }
  }
  return (a + b) / 2;
}

/** Arredonda para cima no múltiplo de `step` (ex.: 0,05 m = 5 cm). */
export const ceilTo = (x: number, stepSize: number) => Math.ceil(x / stepSize - 1e-9) * stepSize;

/** Formata número no padrão brasileiro? Mantemos ponto decimal (padrão atual dos relatórios). */
export const f = (x: number, digits = 2) => x.toFixed(digits);
