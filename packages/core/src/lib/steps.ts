/**
 * Passo a passo, quantitativos e exemplos de referência.
 *
 * - Step: uma conta do cálculo com a fórmula, os números substituídos e o resultado.
 *   Alimenta o "passo a passo", o "conferir minha resposta", a comparação de alternativas
 *   e os testes contra exemplos publicados (Reference.expected usa o id do passo).
 * - Material: quantidade de material para o orçamento (concreto, aço, forma, cabo…).
 */

export interface Step {
  id: string;
  label: string;
  /** fórmula simbólica, ex.: "As = Md/(z·fyd)" */
  expr: string;
  /** a mesma fórmula com os números, ex.: "14000/(43,48·39,76)" */
  subst?: string;
  value: number;
  unit?: string;
  /** casas decimais para exibir o resultado */
  dec?: number;
}

export interface Material { key: string; label: string; qty: number; unit: string }

export interface Reference {
  id: string;
  /** texto do botão, ex.: "Bastos — Flexão, ex. 1" */
  label: string;
  /** obra / autor */
  source: string;
  /** onde está no material (item, página do PDF) */
  where: string;
  url?: string;
  /** observação mostrada ao carregar (ex.: como o dado do livro foi adaptado) */
  note?: string;
  values: Record<string, number | string>;
  /** valor publicado na fonte para cada passo (id do passo) e a tolerância aceita */
  expected: Record<string, { value: number; tol: number }>;
}

/** Número no padrão brasileiro: vírgula decimal. */
export const n = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace(".", ",").replace(/^-(0,0*)$/, "$1") : "—");

export const step = (id: string, label: string, expr: string, subst: string | undefined, value: number, unit = "", dec = 2): Step =>
  ({ id, label, expr, subst, value, unit, dec });

/** Uma linha de texto por passo (vai para o relatório salvo e para o PDF). */
export function stepsText(steps: Step[]) {
  return [
    `── PASSO A PASSO ─────────────────────`,
    ...steps.map((s, i) => {
      const res = `${n(s.value, s.dec ?? 2)}${s.unit ? " " + s.unit : ""}`;
      return `${String(i + 1).padStart(2, "0")}. ${s.label}: ${s.expr}${s.subst ? " = " + s.subst : ""} = ${res}`;
    }),
  ].join("\n");
}

/** Linhas do quantitativo no relatório (formato fixo, lido de volta pelo resumo do projeto). */
export const MATERIAL_PREFIX = "▸ ";
export function materialsText(list: Material[], aviso = "estimativa, sem perdas") {
  return [
    `── QUANTITATIVO (${aviso}) ──`,
    ...list.map((m) => `${MATERIAL_PREFIX}${m.label}: ${m.qty.toFixed(["kg", "sacos", "m"].includes(m.unit) ? 1 : 3)} ${m.unit}`),
  ];
}

/** Lê as linhas "▸ label: qty unidade" de um relatório salvo. */
export function parseMaterials(report: string): Material[] {
  const out: Material[] = [];
  for (const line of report.split("\n")) {
    const m = line.match(/^▸ (.+): (-?[\d.]+) (.+)$/);
    if (m) out.push({ key: `${m[1]}|${m[3]}`, label: m[1]!, qty: Number(m[2]), unit: m[3]! });
  }
  return out;
}

/** Massa linear do aço: 1 cm² de seção × 1 m = 0,785 kg (ρ = 7850 kg/m³). */
export const KG_POR_CM2_M = 0.785;
