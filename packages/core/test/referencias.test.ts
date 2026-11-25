/**
 * Testes contra exemplos RESOLVIDOS publicados (gabarito externo).
 *
 * Diferente dos outros testes (valores calculados por nós), aqui o valor esperado
 * vem de uma fonte publicada. Se o código e a fonte discordarem, o teste falha.
 * Lista completa das fontes, com páginas: test/REFERENCIAS.md
 *
 * Tolerâncias: as fontes arredondam valores intermediários (ex.: 0,128 kN/cm²),
 * então aceitamos a diferença do último dígito publicado.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/index.js";
import { ancoragem } from "../src/civil.js";
import { secaoCurto, correnteNominal, impedanciaTrafo, iccTrifasica, potenciaCapacitor } from "../src/eletrica.js";

const near = (actual: number, expected: number, tol: number, msg = "") =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg}: esperado ${expected} ± ${tol}, obtido ${actual}`);
const grab = (report: string, label: RegExp) => {
  const line = report.split("\n").find((l) => label.test(l));
  assert.ok(line, `linha ${label} não encontrada no relatório`);
  return line!;
};
const num = (line: string, re: RegExp) => Number(line.match(re)![1]);

/*
 * O app estima d = h − cob − φt(6,3 mm) − φl/2(20 mm) = h − cob − 1,63 cm.
 * Os livros dão d direto; então informamos cob = h − d − 1,63 para reproduzir o mesmo d.
 */
const cobPara = (h: number, d: number) => Number((h - d - 1.63).toFixed(2));

/* ═══════════════ CIVIL — Bastos (UNESP), NBR 6118 ═══════════════ */

test("[Bastos, Flexão Simples, ex. 1] C20, 20×50, d = 47, Md = 140 kN·m → x = 18,1 cm, As = 8,10 cm²", () => {
  const out = calculate("civil", "concreto", {
    L: 1, bw: 20, h: 50, cob: cobPara(50, 47), fck: 20, fyk: 500, gk: 0, qk: 0, Mdinf: 140,
  }).val;
  near(num(grab(out, /^d =/), /= ([\d.]+) cm/), 47, 0.05, "d");
  near(num(grab(out, /^βx =/), /x\/d = ([\d.]+)/) * 47, 18.1, 0.1, "x (cm)");
  near(num(grab(out, /^As calculada/), /([\d.]+) cm²/), 8.10, 0.02, "As");
  near(num(grab(out, /^As mínima/), /([\d.]+) cm²/), 1.50, 0.01, "As,mín = 0,15%·20·50");
});

test("[Bastos, Flexão Simples, ex. 3] C25, 22×60, d = 55, Md = 210 kN·m → x = 16,2 cm, As = 9,95 cm²", () => {
  const out = calculate("civil", "concreto", {
    L: 1, bw: 22, h: 60, cob: cobPara(60, 55), fck: 25, fyk: 500, gk: 0, qk: 0, Mdinf: 210,
  }).val;
  near(num(grab(out, /^βx =/), /x\/d = ([\d.]+)/) * 55, 16.2, 0.1, "x (cm)");
  near(num(grab(out, /^As calculada/), /([\d.]+) cm²/), 9.95, 0.02, "As");
  near(num(grab(out, /^As mínima/), /([\d.]+) cm²/), 1.98, 0.01, "As,mín = 0,15%·22·60");
});

test("[Bastos, Força Cortante, ex. 1 — Modelo I] C25, bw = 14, d = 46, 43,7 kN/m em 5 m", () => {
  // Só o cortante faz parte deste exemplo: Md informado simbólico (1 kN·m) para não interferir.
  // Vsd = 1,4·43,7·5/2 = 153,0 kN, igual ao livro (cortante no apoio, sem redução).
  const out = calculate("civil", "concreto", {
    L: 5, bw: 14, h: 50, cob: cobPara(50, 46), fck: 25, fyk: 500, gk: 43.7, qk: 0, Mdinf: 1,
  }).val;
  near(num(grab(out, /^Vsd/), /= ([\d.]+) kN/), 153.0, 0.1, "VSd");
  near(num(grab(out, /^Vrd2 =/), /= ([\d.]+) kN/), 279.5, 0.2, "VRd2");
  assert.match(out, /✓ Vsd ≤ Vrd2/);
  near(num(grab(out, /^Vc =/), /= ([\d.]+) kN/), 49.6, 0.1, "Vc");
  near(num(grab(out, /^Vsw =/), /= ([\d.]+) kN/), 103.4, 0.1, "Vsw");
  near(num(grab(out, /^Asw\/s calc/), /([\d.]+) cm²\/m/), 5.73, 0.02, "Asw/s");
  near(num(grab(out, /^Asw\/s mínimo/), /([\d.]+) cm²\/m/), 1.44, 0.01, "Asw,mín");
});

test("[Bastos, Ancoragem, Tabela A-1] lb do CA-50 nervurado bate com a tabela (cm)", () => {
  // [φ (mm), fck, boa aderência?, gancho?, valor da tabela (cm)]
  const casos: Array<[number, number, boolean, boolean, number]> = [
    [10, 20, true, false, 44], [10, 20, false, false, 62],
    [12.5, 40, true, false, 34],
    [16, 25, true, false, 60], [16, 25, false, false, 86], [16, 25, true, true, 42],
    [20, 30, true, false, 67], [20, 30, true, true, 47],
    [25, 35, true, false, 75], [25, 35, false, true, 75],
  ];
  for (const [phi, fck, boa, gancho, tabela] of casos) {
    const r = ancoragem({ phi, fck, fyk: 500, barra: "nervurada", boa, gancho });
    near(r.lbnec / 10, tabela, 1, `φ${phi} C${fck} ${boa ? "boa" : "má"} ${gancho ? "com" : "sem"} gancho`);
  }
});

/* ═══════════════ ELÉTRICA ═══════════════ */

test("[Prysmian, Guia BT, item 7] Icc = 10 kA, t = 0,5 s → seção por curto (k = 143 / 176 / 128 / 228)", () => {
  near(secaoCurto(10000, 0.5, 143), 49.44, 0.01, "k = 143");
  near(secaoCurto(10000, 0.5, 176), 40.17, 0.01, "k = 176");
  near(secaoCurto(10000, 0.5, 159), 44.47, 0.01, "k = 159");
  near(secaoCurto(10000, 0.5, 128), 55.24, 0.01, "k = 128");
  near(secaoCurto(10000, 0.5, 228), 31.01, 0.01, "k = 228");

  const out = calculate("eletrica", "curto_circuito", { Icc: 10, t: 0.5, material: "cu_xlpe" }).val;
  assert.match(out, /Smín exigida:\s+49\.4\d mm²/);
  assert.match(out, /Seção comercial sugerida: 50 mm²/);
  const out128 = calculate("eletrica", "curto_circuito", { Icc: 10, t: 0.5, material: "outro", k: 128 }).val;
  assert.match(out128, /Seção comercial sugerida: 70 mm²/, "55,24 mm² → 70 mm² (Prysmian)");
});

test("[Memorial TRF2 / Cotrim] trafo 1000 kVA, 220 V, Z = 6,45 % → In = 2624,5 A, Icc = 40,69 kA", () => {
  // O memorial arredonda (2624,32 A exato → "≈ 2.624,5"); a diferença é de 0,2 A em 2600 A.
  near(correnteNominal(1000, 220), 2624.5, 0.5, "In");
  for (const XR of [1, 5, 10]) { // Icc nos terminais não depende da relação X/R, só de |Z|
    const T = impedanciaTrafo(1000, 220, 6.45, XR);
    near(iccTrifasica(220, T.R, T.X) / 1000, 40.69, 0.01, `Icc (X/R = ${XR})`);
  }
});

test("[WEG, Correção do FP, tabela de fatores F] F = tan φ1 − tan φ2", () => {
  // [FP atual, FP desejado, F da tabela WEG]
  const casos: Array<[number, number, number]> = [
    [0.50, 0.92, 1.306], [0.60, 0.99, 1.190], [0.70, 0.95, 0.691],
    [0.80, 0.92, 0.324], [0.80, 0.85, 0.130], [0.84, 0.92, 0.220], [0.88, 0.95, 0.211],
  ];
  for (const [fp1, fp2, F] of casos) near(potenciaCapacitor(1, fp1, fp2), F, 0.001, `F(${fp1} → ${fp2})`);
});

test("[WEG, Correção do FP, ex. motor] 55 kW a 75 % de carga, η = 93,2 % → 9,73 kvar", () => {
  // ATENÇÃO — deslize no catálogo: o enunciado diz FP atual 0,85, mas usa F = 0,220,
  // que é a linha 0,84 da tabela (a tabela não tem linha 0,85). Reproduzimos o número
  // publicado com FP 0,84 e conferimos o valor correto para 0,85 pela mesma fórmula.
  const P_eletrica = (0.75 * 55) / 0.932; // potência absorvida da rede (kW)
  near(potenciaCapacitor(P_eletrica, 0.84, 0.92), 9.73, 0.02, "Qc publicado (F = 0,220)");
  near(potenciaCapacitor(P_eletrica, 0.85, 0.92), 8.58, 0.01, "Qc correto para FP 0,85 (F = 0,1937)");
});

test("[WEG, Correção do FP, ex. 930 kW] FP 0,65 em 380 V → S = 1431 kVA, I = 2174 A", () => {
  const out = calculate("eletrica", "fator_potencia", { P: 930, fp1: 0.65, fp2: 0.92, V: 380 }).val;
  const linha = grab(out, /^S1 =/);
  near(num(linha, /S1 = ([\d.]+) kVA/), 1431, 1, "S1");
  near(num(linha, /I1 = ([\d.]+) A/), 2174, 1, "I1");
});

/* ═══════════════ Botões "exemplo do livro" da folha (src/referencias.ts) ═══════════════
 * Cada exemplo carregado no site precisa reproduzir os valores publicados, passo a passo. */
import { DATA } from "../src/index.js";

for (const [areaKey, area] of Object.entries(DATA as Record<string, any>)) {
  for (const calc of area.calcs) {
    for (const ref of calc.references ?? []) {
      test(`[exemplo do site] ${areaKey}/${calc.id} — ${ref.label}`, () => {
        const r = calculate(areaKey, calc.id, ref.values) as any;
        for (const [id, exp] of Object.entries(ref.expected as Record<string, { value: number; tol: number }>)) {
          const s = r.steps?.find((x: any) => x.id === id);
          assert.ok(s, `passo "${id}" não existe no cálculo ${calc.id}`);
          near(s.value, exp.value, exp.tol, `${ref.label} · ${s.label}`);
        }
      });
    }
  }
}

test("todo cálculo devolve passo a passo com valores numéricos (exemplo padrão)", () => {
  for (const [areaKey, area] of Object.entries(DATA as Record<string, any>)) {
    for (const calc of area.calcs) {
      const r = calculate(areaKey, calc.id, calc.example) as any;
      assert.ok(r.steps?.length > 0, `${areaKey}/${calc.id} sem passos`);
      for (const s of r.steps) assert.ok(Number.isFinite(s.value), `${areaKey}/${calc.id} passo ${s.id} = ${s.value}`);
    }
  }
});
