import { DATA, ICONS, CABLE_CATALOG } from "./data.js";

export { DATA, ICONS, CABLE_CATALOG };

export interface EngineResult {
  val: string;
  unit?: string;
  multi?: boolean;
}

export function calculate(areaKey: string, calcId: string, values: Record<string, number | string>): EngineResult {
  const areas = DATA as Record<string, any>;
  const calculation = areas[areaKey]?.calcs.find((item: { id: string }) => item.id === calcId);
  if (!calculation) throw new Error("Cálculo não encontrado");
  return calculation.calc(values);
}
