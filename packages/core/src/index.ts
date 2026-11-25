import { DATA, ICONS, CABLE_CATALOG } from "./data.js";

import type { Step, Material, Reference } from "./lib/steps.js";

export { DATA, ICONS, CABLE_CATALOG };
export { stepsText, parseMaterials, n as fmtBR, type Step, type Material, type Reference } from "./lib/steps.js";
/* Tabelas de consulta (tela "Tabelas") */
export { BARRAS, TAB_17_3 } from "./lib/concreto.js";
export { izTabela, resistenciaCondutor, SECOES_IZ, K_ADIABATICO, METODOS, SECAO_MIN_AL } from "./lib/nbr5410.js";
export { ancoragem } from "./civil.js";
export { DISJUNTORES_IN, BANCOS_KVAR } from "./eletrica.js";
export { ROSCAS, MODULOS_I, MODULOS_II, MATERIAIS_EIXO, propriedadesClasse } from "./mecanica.js";

export interface EngineResult {
  val: string;
  unit?: string;
  multi?: boolean;
  links?: Array<{ label: string; area: string; calcId: string; values: Record<string, number | string> }>;
  /** passo a passo: fórmula, números substituídos e resultado de cada conta */
  steps?: Step[];
  /** quantitativo de materiais para orçamento */
  materials?: Material[];
}
export type { Reference as CalcReference };

export type RawValues = Record<string, number | string | null | undefined>;

const isEmpty = (value: unknown) => value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));

/** Campo visível? (campos com dependsOn só existem quando o select de controle tem um dos valores) */
function isVisible(field: any, fields: any[], values: RawValues) {
  if (!field.dependsOn) return true;
  const ctrl = fields.find((f: any) => f.id === field.dependsOn.id);
  const current = isEmpty(values[field.dependsOn.id]) ? ctrl?.options?.[0]?.value : values[field.dependsOn.id];
  return field.dependsOn.in.includes(String(current));
}

/**
 * Valida e normaliza as entradas (constituição §4):
 * - campo obrigatório vazio → erro (nunca vira 0);
 * - campo opcional vazio → undefined;
 * - select vazio → primeira opção.
 */
export function normalizeValues(calculation: any, values: RawValues): Record<string, any> {
  const out: Record<string, any> = {};
  for (const field of calculation.fields) {
    const raw = values[field.id];
    if (field.type === "select") {
      const allowed = field.options.map((o: any) => o.value);
      const v = isEmpty(raw) ? allowed[0] : String(raw);
      if (!allowed.includes(v)) throw new Error(`Opção inválida em "${field.label}"`);
      out[field.id] = v;
      continue;
    }
    if (!isVisible(field, calculation.fields, values)) { out[field.id] = undefined; continue; }
    if (isEmpty(raw)) {
      if (field.optional) { out[field.id] = undefined; continue; }
      throw new Error(`Preencha o campo "${field.label}"`);
    }
    const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) throw new Error(`Valor inválido em "${field.label}"`);
    out[field.id] = n;
  }
  return out;
}

export function findCalculation(areaKey: string, calcId: string) {
  const areas = DATA as Record<string, any>;
  return areas[areaKey]?.calcs.find((item: { id: string }) => item.id === calcId);
}

export function calculate(areaKey: string, calcId: string, values: RawValues): EngineResult {
  const calculation = findCalculation(areaKey, calcId);
  if (!calculation) throw new Error("Cálculo não encontrado");
  return calculation.calc(normalizeValues(calculation, values));
}
