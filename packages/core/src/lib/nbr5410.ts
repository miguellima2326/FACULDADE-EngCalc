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
