/**
 * Testes de aceitação — spec 008 (Elétrica avançada).
 * Valores de referência calculados à mão a partir das fórmulas da spec.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/index.js";
import {
  ELETRICA, correnteMotor, CV_W, potenciaCapacitor, fpResultante, escolherDisjuntor,
  impedanciaTrafo, iccTrifasica, correnteNominal, secaoAutomatica, quedaTensaoRX, correnteDePotencia,
} from "../src/eletrica.js";
import { izTabela, resistenciaCondutor } from "../src/lib/nbr5410.js";

const near = (a: number, e: number, tol: number, msg = "") =>
  assert.ok(Math.abs(a - e) <= tol, `${msg} esperado ${e} ± ${tol}, obtido ${a}`);

/* ── L2 Icc ── */
test("L2: Icc no secundário 1000 kVA / 380 V / 5 % = In/Z% = 30,39 kA", () => {
  const T = impedanciaTrafo(1000, 380, 5, 5);
  near(T.Z * 1000, 7.22, 0.001, "Z_T (mΩ) = 0,05·380²/1e6");
  near(iccTrifasica(380, T.R, T.X) / 1000, 30.39, 0.01, "Icc (kA)");
  near(correnteNominal(1000, 380) / 0.05 / 1000, 30.39, 0.01, "In/Z%");
});

test("L2: cabo reduz o Icc no fim do circuito e gera link para seção mínima", () => {
  const r = calculate("eletrica", "icc", { S: 1000, V: 380, Z: 5, XR: 5, secao: 95, material: "cu", L: 50, np: 1 }) as any;
  // Z_T = 7,22 mΩ (R 1,416 / X 7,080); cabo: R = 0,193·0,05 = 9,65 mΩ, X = 4 mΩ → |Z| = √(11,066² + 11,080²) = 15,66 mΩ → 14,01 kA
  assert.match(r.val, /Icc no fim do cabo = 14\.0\d kA/);
  assert.equal(r.links[0].calcId, "curto_circuito");
  near(r.links[0].values.Icc, 30.39, 0.01);
});

/* ── L5 Motor ── */
test("L5: motor 10 cv, 380 V, η 0,88, cos φ 0,85 → In = 7355/(√3·380·0,88·0,85) = 14,94 A", () => {
  near(correnteMotor(10 * CV_W, 380, 0.88, 0.85, "tri"), 14.94, 0.01);
  const r = calculate("eletrica", "motor", { unidade: "cv", P: 10, sistema: "tri", V: 380, eta: 0.88, fp: 0.85, IpIn: 7 }) as any;
  assert.match(r.val, /In = .* = 14\.94 A/);
  assert.match(r.val, /Ib \(circuito do motor\) = 1,25·In = 18\.67 A/);
  assert.equal(r.links[0].calcId, "secao_cabo");
  near(r.links[0].values.Ib, 18.67, 0.01);
});

/* ── L4 Fator de potência ── */
test("L4: 100 kW de 0,80 para 0,92 → Qc = 100·(0,75 − 0,4260) = 32,40 kvar, banco 40 kvar", () => {
  near(potenciaCapacitor(100, 0.8, 0.92), 32.4, 0.01);
  const r = calculate("eletrica", "fator_potencia", { P: 100, fp1: 0.8, fp2: 0.92, V: 380 }).val;
  assert.match(r, /Qc = .* = 32\.40 kvar/);
  assert.match(r, /Banco sugerido: 40 kvar/);
  // com 40 kvar: Q = 75 − 40 = 35 → FP = 100/√(100² + 35²) = 0,944
  near(fpResultante(100, 0.8, 40), 0.9439, 0.0005);
});

/* ── L3 Disjuntor ── */
test("L3: Ib 28 A, Iz 41 A → disjuntor 32 A (I2 = 46,4 ≤ 59,45)", () => {
  const d = escolherDisjuntor(28, 41, 1.45);
  assert.equal(d.In, 32);
  assert.ok(d.ok1 && d.ok2);
  assert.match(calculate("eletrica", "disjuntor", { Ib: 28, Iz: 41, norma: "60898", curva: "C" }).val, /✓ Disjuntor 32 A, curva C/);
});

test("L3: sem In comercial entre Ib e Iz → reprova", () => {
  // Ib 26 → próximo In = 32 > Iz 30
  assert.match(calculate("eletrica", "disjuntor", { Ib: 26, Iz: 30, norma: "60898", curva: "C" }).val, /✗ Nenhum In comercial/);
});

/* ── L1 Seção automática ── */
test("L1: tabelas — Iz Cu PVC B1 3 carregados 25 mm² = 89 A; XLPE C 2 carregados 240 mm² = 599 A", () => {
  assert.equal(izTabela("cu", "pvc", 3, "B1", 25), 89);
  assert.equal(izTabela("cu", "xlpe", 2, "C", 240), 599);
  assert.equal(izTabela("al", "pvc", 3, "B1", 10), null);
  near(resistenciaCondutor("cu", 25, 70)!, 0.727 * (1 + 0.00393 * 50), 1e-9);
});

test("L1: caso típico — Ib 85 A, tri 380 V, Cu PVC B1, 30 °C, 1 circuito, 60 m, ΔV 4 %, Icc 10 kA / 0,5 s", () => {
  // Capacidade: B1 3 carr. PVC: 25 mm² → 89 A ≥ 85 ✓ (16 mm² → 68 A ✗)
    //        → 10 mm² (R70 2,1896: ΔV = √3·85·0,06·2,0458/380 = 4,76 % ✗) → 16 mm² (R70 1,3760: ΔV = 3,02 % ✓)
  // Curto: Smín = 10000·√0,5/115 = 61,5 mm² → 70 mm² — determinante
  const r = secaoAutomatica({ Ib: 85, V: 380, fp: 0.92, sistema: "tri", material: "cu", isolacao: "pvc", metodo: "B1", Kcorr: 1, L: 60, dVadm: 4, Icc: 10, t: 0.5 });
  assert.equal(r.porCapacidade!.s, 25);
  assert.equal(r.porQueda!.s, 16);
  near(r.sMinCurto, 61.49, 0.01);
  assert.equal(r.porCurto!.s, 70);
  assert.equal(r.adotada!.s, 70);
  assert.equal(r.determinante, "Curto-circuito");
  near(quedaTensaoRX(85, 60, resistenciaCondutor("cu", 16, 70)!, 0.08, 0.92, 380, "tri"), 3.02, 0.01);
});

test("L1: sem Icc → determinante é a capacidade; relatório traz link para disjuntor", () => {
  const r = calculate("eletrica", "secao_cabo", { modo: "corrente", Ib: 85, sistema: "tri", V: 380, fp: 0.92, material: "cu", isolacao: "pvc", metodo: "B1", temp: 30, nCircuitos: 1, L: 60, dVadm: 4 }) as any;
  assert.match(r.val, /✓ SEÇÃO ADOTADA: 25 mm²/);
  assert.match(r.val, /Fator determinante: Capacidade de condução/);
  assert.equal(r.links[0].calcId, "disjuntor");
});

test("L1: modo potência — Ib = P/(√3·V·cosφ)", () => {
  near(correnteDePotencia(45, 380, 0.92, "tri"), 74.32, 0.01);
  const r = calculate("eletrica", "secao_cabo", { modo: "potencia", P: 45, sistema: "tri", V: 380, fp: 0.92, material: "cu", isolacao: "xlpe", metodo: "C", temp: 30, nCircuitos: 1, L: 40, dVadm: 4 }).val;
  assert.match(r, /= 74\.32 A/);
});

/* ── Convenção §7: example ── */
test("§7: todo cálculo elétrico tem `example` que roda sem erro", () => {
  for (const c of ELETRICA.calcs as any[]) {
    assert.ok(c.example, `${c.id} sem example`);
    assert.doesNotThrow(() => calculate("eletrica", c.id, c.example), `${c.id}: example falhou`);
  }
});
