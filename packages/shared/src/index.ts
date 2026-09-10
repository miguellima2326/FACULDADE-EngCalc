export interface CalculationField {
  id: string;
  label: string;
  placeholder?: string;
  hint?: string;
  type?: "number" | "select";
  options?: Array<{ value: string; label: string }>;
  dependsOn?: { id: string; values: string[] };
}

export interface CalculationResult {
  value: string;
  unit?: string;
  multi?: boolean;
}

export interface CalculationDefinition {
  id: string;
  name: string;
  description: string;
  formula: string;
  context?: string;
  norma?: string;
  fields: CalculationField[];
}

export interface RpmInput { vc: number; d: number }
