/**
 * Fatores de correção da capacidade de condução de corrente (Iz).
 * Fonte: NBR 5410:2004 (equivalente IEC 60364-5-52, anexo B) e, para MT,
 * IEC 60502-2 como aproximação da NBR 14039.
 */
import { interp, step, type Table } from "./math.js";

export type Nivel = "BT" | "MT";
export type Isolacao = "pvc" | "xlpe";
export type Instalacao = "enterrado_direto" | "enterrado_duto" | "ao_ar";
export type Espacamento = "encostados" | "1_diametro" | "0.125" | "0.25" | "0.5" | "1.0";

/* ── NBR 5410 Tab. 40 (IEC B.52.14 / B.52.15) — temperatura ─────────────
   Ar: referência 30 °C · Solo: referência 20 °C                        */
export const TAB40_AR: Record<Isolacao, Table> = {
  pvc:  [[10,1.22],[15,1.17],[20,1.12],[25,1.06],[30,1.00],[35,0.94],[40,0.87],[45,0.79],[50,0.71],[55,0.61],[60,0.50]],
  xlpe: [[10,1.15],[15,1.12],[20,1.08],[25,1.04],[30,1.00],[35,0.96],[40,0.91],[45,0.87],[50,0.82],[55,0.76],[60,0.71],[65,0.65],[70,0.58],[75,0.50],[80,0.41]],
};
export const TAB40_SOLO: Record<Isolacao, Table> = {
  pvc:  [[10,1.10],[15,1.05],[20,1.00],[25,0.95],[30,0.89],[35,0.84],[40,0.77],[45,0.71],[50,0.63],[55,0.55],[60,0.45]],
  xlpe: [[10,1.07],[15,1.04],[20,1.00],[25,0.96],[30,0.93],[35,0.89],[40,0.85],[45,0.80],[50,0.76],[55,0.71],[60,0.65],[65,0.60],[70,0.53],[75,0.46],[80,0.38]],
};
/** Limite de temperatura (fator → 0) de cada isolação, para validação. */
const TEMP_MAX: Record<Isolacao, number> = { pvc: 60, xlpe: 80 };

/* ── NBR 5410 Tab. 41 (IEC B.52.16) — resistividade térmica do solo ────
   Referência 2,5 K·m/W. [CONFIRMAR NA NORMA] — valores da IEC B.52.16;
   a NBR 5410 tabela só parte destes pontos.                            */
export const TAB41_DUTO: Table   = [[0.5,1.28],[0.7,1.20],[1.0,1.18],[1.5,1.10],[2.0,1.05],[2.5,1.00],[3.0,0.96]];
export const TAB41_DIRETO: Table = [[0.5,1.88],[0.7,1.62],[1.0,1.50],[1.5,1.28],[2.0,1.12],[2.5,1.00],[3.0,0.90]];

/* ── NBR 5410 Tab. 42 (IEC B.52.17) — agrupamento em feixe/ao ar ───────
   Degraus: 9–11 → 0,50; 12–15 → 0,45; 16–19 → 0,41; ≥20 → 0,38          */
export const TAB42_AR: Table = [[1,1.00],[2,0.80],[3,0.70],[4,0.65],[5,0.60],[6,0.57],[7,0.54],[8,0.52],[9,0.50],[12,0.45],[16,0.41],[20,0.38]];

/* ── Agrupamento de linhas enterradas ───────────────────────────────────
   Diretamente enterrados: NBR 5410 Tab. 44 (IEC B.52.18)
   Em eletrodutos enterrados: NBR 5410 Tab. 45 (IEC B.52.19)
   Linhas: n = 2..6 circuitos. [CONFIRMAR NA NORMA]                      */
export const TAB44_DIRETO: Record<string, readonly number[]> = {
  //            n=2   n=3   n=4   n=5   n=6
  encostados:   [0.75, 0.65, 0.60, 0.55, 0.50],
  "1_diametro": [0.80, 0.70, 0.60, 0.55, 0.55],
  "0.125":      [0.85, 0.75, 0.70, 0.65, 0.60],
  "0.25":       [0.90, 0.80, 0.75, 0.70, 0.70],
  "0.5":        [0.90, 0.85, 0.80, 0.80, 0.80],
};
export const TAB45_DUTO: Record<string, readonly number[]> = {
  encostados: [0.85, 0.75, 0.70, 0.65, 0.60],
  "0.25":     [0.90, 0.85, 0.80, 0.80, 0.80],
  "0.5":      [0.95, 0.90, 0.85, 0.85, 0.80],
  "1.0":      [0.95, 0.95, 0.90, 0.90, 0.90],
};
const ORDEM_ESPACAMENTO: Espacamento[] = ["encostados", "1_diametro", "0.125", "0.25", "0.5", "1.0"];
const ESPACAMENTO_M: Record<Espacamento, number> = { encostados: 0, "1_diametro": 0.05, "0.125": 0.125, "0.25": 0.25, "0.5": 0.5, "1.0": 1.0 };
export const LABEL_ESPACAMENTO: Record<Espacamento, string> = {
  encostados: "encostados", "1_diametro": "1 diâmetro de cabo", "0.125": "0,125 m", "0.25": "0,25 m", "0.5": "0,5 m", "1.0": "1,0 m",
};

/* ── Profundidade (somente MT) — IEC 60502-2, referência 0,8 m ──────────
   [CONFIRMAR NBR 14039]. Em BT a NBR 5410 (método D) usa 0,7 m sem fator. */
export const TAB_PROFUNDIDADE_MT: Table = [[0.5,1.04],[0.6,1.02],[0.7,1.01],[0.8,1.00],[0.9,0.98],[1.0,0.97],[1.25,0.95],[1.5,0.93],[2.0,0.90],[2.5,0.87],[3.0,0.85]];

export const LABEL_ISOLACAO: Record<Isolacao, string> = { pvc: "PVC (70 °C)", xlpe: "EPR/XLPE (90 °C)" };

export interface FatorInput {
  nivel: Nivel; isolacao: Isolacao; instalacao: Instalacao;
  temp: number; resSolo?: number; profundidade?: number; nCircuitos: number; espacamento?: Espacamento;
}
export interface FatorResult {
  Kt: number; Ks: number; Kp: number; Kg: number; Ktotal: number; Fc: number;
  avisos: string[]; refs: { Kt: string; Ks: string; Kp: string; Kg: string };
  espacamentoUsado?: Espacamento;
}

function fatorEnterrado(tab: Record<string, readonly number[]>, n: number, esp: Espacamento, avisos: string[]) {
  let usado = esp;
  if (!tab[usado]) {
    // escolhe a opção existente mais próxima em distância física
    const alvo = ESPACAMENTO_M[esp];
    usado = (Object.keys(tab) as Espacamento[]).reduce((best, k) =>
      Math.abs(ESPACAMENTO_M[k] - alvo) < Math.abs(ESPACAMENTO_M[best] - alvo) ? k : best);
    avisos.push(`⚠ espaçamento "${LABEL_ESPACAMENTO[esp]}" não existe nesta tabela — usado "${LABEL_ESPACAMENTO[usado]}"`);
  }
  if (n <= 1) return { Kg: 1, usado };
  if (n > 6) avisos.push(`⚠ ${n} circuitos: tabela vai até 6 — usado o fator de 6 circuitos (confirme com o fabricante)`);
  const row = tab[usado]!;
  return { Kg: row[Math.min(n, 6) - 2]!, usado };
}

/** Fc = 1/(Kt·Ks·Kp·Kg) — corrente fictícia Ic = In·Fc é comparada com Iz de tabela. */
export function fatorInstalacao(v: FatorInput): FatorResult {
  const avisos: string[] = [];
  if (!["BT", "MT"].includes(v.nivel)) throw new Error("Nível de tensão inválido");
  if (!["pvc", "xlpe"].includes(v.isolacao)) throw new Error("Isolação inválida");
  if (!["enterrado_direto", "enterrado_duto", "ao_ar"].includes(v.instalacao)) throw new Error("Método de instalação inválido");
  if (!Number.isFinite(v.temp)) throw new Error("Temperatura do solo/ambiente deve ser informada");
  if (v.temp >= TEMP_MAX[v.isolacao] + 5) throw new Error(`Temperatura ${v.temp} °C acima do limite tabelado para ${LABEL_ISOLACAO[v.isolacao]}`);
  if (!Number.isInteger(v.nCircuitos) || v.nCircuitos < 1) throw new Error("Número de circuitos agrupados deve ser um inteiro ≥ 1");

  const enterrado = v.instalacao !== "ao_ar";
  const iso = LABEL_ISOLACAO[v.isolacao];
  const tabT = enterrado ? TAB40_SOLO[v.isolacao] : TAB40_AR[v.isolacao];
  const tFirst = tabT[0]![0], tLast = tabT[tabT.length - 1]![0];
  if (v.temp < tFirst || v.temp > tLast) avisos.push(`⚠ temperatura fora da faixa tabelada (${tFirst}–${tLast} °C) — fator saturado no extremo`);
  const Kt = interp(tabT, v.temp);
  const refs = {
    Kt: `NBR 5410 Tab. 40, ${iso} ${enterrado ? "no solo (ref. 20 °C)" : "ao ar (ref. 30 °C)"}`,
    Ks: "não aplicável (ao ar)", Kp: "não aplicável (ao ar)", Kg: "",
  };

  let Ks = 1, Kp = 1, Kg = 1, espacamentoUsado: Espacamento | undefined;
  if (enterrado) {
    if (!(Number(v.resSolo) > 0)) throw new Error("Resistividade do solo deve ser > 0 para instalação enterrada");
    if (!(Number(v.profundidade) > 0)) throw new Error("Profundidade deve ser > 0 para instalação enterrada");
    const direto = v.instalacao === "enterrado_direto";
    Ks = interp(direto ? TAB41_DIRETO : TAB41_DUTO, v.resSolo!);
    refs.Ks = `NBR 5410 Tab. 41 (IEC B.52.16), ${direto ? "diretamente enterrado" : "em eletroduto enterrado"}, ref. 2,5 K·m/W`;
    if (v.nivel === "MT") {
      Kp = interp(TAB_PROFUNDIDADE_MT, v.profundidade!);
      refs.Kp = "IEC 60502-2, ref. 0,8 m [CONFIRMAR NBR 14039]";
    } else {
      Kp = 1;
      refs.Kp = "NBR 5410 método D — ref. 0,7 m, sem correção de profundidade";
    }
    const esp = (v.espacamento && ORDEM_ESPACAMENTO.includes(v.espacamento) ? v.espacamento : "encostados") as Espacamento;
    const r = fatorEnterrado(direto ? TAB44_DIRETO : TAB45_DUTO, v.nCircuitos, esp, avisos);
    Kg = r.Kg; espacamentoUsado = r.usado;
    refs.Kg = `${direto ? "NBR 5410 Tab. 44 (IEC B.52.18)" : "NBR 5410 Tab. 45 (IEC B.52.19)"}, ${LABEL_ESPACAMENTO[r.usado]}`;
  } else {
    Kg = step(TAB42_AR, v.nCircuitos);
    refs.Kg = "NBR 5410 Tab. 42 (feixe / ao ar)";
  }

  if (v.nivel === "MT") avisos.push("⚠ MT: fatores da NBR 5410 / IEC 60502-2 usados como aproximação da NBR 14039 — confirme na norma/fabricante");

  const Ktotal = Kt * Ks * Kp * Kg;
  return { Kt, Ks, Kp, Kg, Ktotal, Fc: 1 / Ktotal, avisos, refs, espacamentoUsado };
}

/* ═══════════════════ Capacidade de condução — Iz (spec 008, L1) ═══════════════════
 * NBR 5410 Tab. 36 (PVC, 70 °C) e Tab. 37 (EPR/XLPE, 90 °C), condutores de COBRE,
 * equivalentes à IEC 60364-5-52 B.52.2 a B.52.5. Ar ambiente 30 °C (A1–C); solo 20 °C e
 * 2,5 K·m/W para o método D (cabo em eletroduto enterrado).
 * [CONFIRMAR NA NORMA] — valores transcritos de memória da IEC 60364-5-52/NBR 5410.
 * Colunas: A1, A2, B1, B2, C, D.
 */
export type Metodo = "A1" | "A2" | "B1" | "B2" | "C" | "D";
export const METODOS: Metodo[] = ["A1", "A2", "B1", "B2", "C", "D"];
export const SECOES_IZ = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300] as const;

type IzRow = readonly [number, number, number, number, number, number];
const IZ_CU: Record<Isolacao, Record<2 | 3, readonly IzRow[]>> = {
  pvc: {
    2: [
      [14.5, 14, 17.5, 16.5, 19.5, 22], [19.5, 18.5, 24, 23, 27, 29], [26, 25, 32, 30, 36, 38], [34, 32, 41, 38, 46, 47],
      [46, 43, 57, 52, 63, 63], [61, 57, 76, 69, 85, 81], [80, 75, 101, 90, 112, 104], [99, 92, 125, 111, 138, 125],
      [119, 110, 151, 133, 168, 148], [151, 139, 192, 168, 213, 183], [182, 167, 232, 201, 258, 216], [210, 192, 269, 232, 299, 246],
      [240, 219, 309, 265, 344, 278], [273, 248, 353, 300, 392, 312], [321, 291, 415, 351, 461, 361], [367, 334, 477, 401, 530, 408],
    ],
    3: [
      [13.5, 13, 15.5, 15, 17.5, 18], [18, 17.5, 21, 20, 24, 24], [24, 23, 28, 27, 32, 31], [31, 29, 36, 34, 41, 39],
      [42, 39, 50, 46, 57, 52], [56, 52, 68, 62, 76, 67], [73, 68, 89, 80, 96, 86], [89, 83, 110, 99, 119, 103],
      [108, 99, 134, 118, 144, 122], [136, 125, 171, 149, 184, 151], [164, 150, 207, 179, 223, 179], [188, 172, 239, 206, 259, 203],
      [216, 196, 275, 225, 299, 230], [245, 223, 314, 255, 341, 258], [286, 261, 370, 297, 403, 297], [328, 298, 426, 339, 464, 336],
    ],
  },
  xlpe: {
    2: [
      [19, 18.5, 23, 22, 24, 26], [26, 25, 31, 30, 33, 34], [35, 33, 42, 40, 45, 44], [45, 42, 54, 51, 58, 56],
      [61, 57, 75, 69, 80, 73], [81, 76, 100, 91, 107, 95], [106, 99, 133, 119, 138, 121], [131, 121, 164, 146, 171, 146],
      [158, 145, 198, 175, 209, 173], [200, 183, 253, 221, 269, 213], [241, 220, 306, 265, 328, 252], [278, 253, 354, 305, 382, 287],
      [318, 290, 407, 349, 441, 324], [362, 329, 464, 395, 506, 363], [424, 386, 546, 462, 599, 419], [486, 442, 628, 529, 693, 474],
    ],
    3: [
      [17, 16.5, 20, 19.5, 22, 22], [23, 22, 28, 26, 30, 29], [31, 30, 37, 35, 40, 37], [40, 38, 48, 44, 52, 46],
      [54, 51, 66, 60, 71, 61], [73, 68, 88, 80, 96, 79], [95, 89, 117, 105, 119, 101], [117, 109, 144, 128, 147, 122],
      [141, 130, 175, 154, 179, 144], [179, 164, 222, 194, 229, 178], [216, 197, 269, 233, 278, 211], [249, 227, 312, 268, 322, 240],
      [285, 259, 342, 300, 371, 271], [324, 295, 384, 340, 424, 304], [380, 346, 450, 398, 500, 351], [435, 396, 514, 455, 576, 396],
    ],
  },
};

/** Alumínio: aproximado como 0,78 × Iz do cobre (relação típica da NBR 5410 Tab. 36/37) — [CONFIRMAR NA NORMA]. */
export const FATOR_AL_APROX = 0.78;
export type Material = "cu" | "al";
export const SECAO_MIN_AL = 16;

/** Iz tabelado (A) para material/isolação/nº de condutores carregados/método/seção. */
export function izTabela(material: Material, isolacao: Isolacao, carregados: 2 | 3, metodo: Metodo, secao: number): number | null {
  const i = SECOES_IZ.indexOf(secao as (typeof SECOES_IZ)[number]);
  const j = METODOS.indexOf(metodo);
  if (i < 0 || j < 0) return null;
  if (material === "al" && secao < SECAO_MIN_AL) return null;
  const base = IZ_CU[isolacao][carregados][i]![j]!;
  return material === "al" ? Math.round(base * FATOR_AL_APROX * 10) / 10 : base;
}

/* ── Resistência do condutor (IEC 60228, classe 2, CC a 20 °C, Ω/km) ── */
const R20_CU: Record<number, number> = { 1.5: 12.1, 2.5: 7.41, 4: 4.61, 6: 3.08, 10: 1.83, 16: 1.15, 25: 0.727, 35: 0.524, 50: 0.387, 70: 0.268, 95: 0.193, 120: 0.153, 150: 0.124, 185: 0.0991, 240: 0.0754, 300: 0.0601 };
const R20_AL: Record<number, number> = { 16: 1.91, 25: 1.20, 35: 0.868, 50: 0.641, 70: 0.443, 95: 0.320, 120: 0.253, 150: 0.206, 185: 0.164, 240: 0.125, 300: 0.100 };
const ALPHA: Record<Material, number> = { cu: 0.00393, al: 0.00403 };
export const TEMP_OPERACAO: Record<Isolacao, number> = { pvc: 70, xlpe: 90 };
/** Reatância indutiva típica de cabos BT (unipolares encostados em trifólio / multipolares): ≈ 0,08 Ω/km. Aproximação. */
export const X_CABO_OHM_KM = 0.08;

/** R (Ω/km) na temperatura θ: R20·[1 + α·(θ − 20)]. Efeito pelicular desprezado (seções ≤ 300 mm²). */
export function resistenciaCondutor(material: Material, secao: number, theta = 20): number | null {
  const r20 = (material === "cu" ? R20_CU : R20_AL)[secao];
  if (r20 === undefined) return null;
  return r20 * (1 + ALPHA[material] * (theta - 20));
}

/** k da fórmula adiabática (NBR 5410 Tab. 30, condutores ≤ 300 mm²). */
export const K_ADIABATICO: Record<Material, Record<Isolacao, number>> = { cu: { pvc: 115, xlpe: 143 }, al: { pvc: 76, xlpe: 94 } };
