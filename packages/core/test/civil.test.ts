/**
 * Testes de aceitação — spec 001, blocos A–E (Civil).
 * Valores de referência calculados à mão pelas fórmulas da norma (ver spec.md).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate } from "../src/index.js";
import { vigaContinua2Vaos, pressaoSolo } from "../src/civil.js";
import { secaoCircularParcial, vazaoCircular, laminaParaVazao, kirpich, diametroSecaoPlena } from "../src/lib/hidraulica.js";
import { armaduraFlexoCompressao, momentoResistente, fcd, fyd, KMD_LIM, rhoMinFlexao } from "../src/lib/concreto.js";

const near = (actual: number, expected: number, tol: number, msg = "") =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} esperado ${expected} ± ${tol}, obtido ${actual}`);
const grab = (report: string, label: RegExp) => {
  const line = report.split("\n").find((l) => label.test(l));
  assert.ok(line, `linha ${label} não encontrada no relatório`);
  return line!;
};
const num = (line: string, re: RegExp) => Number(line.match(re)![1]);

/* ── A. Viga contínua ── */
test("A1–A3: viga contínua simétrica 6 m / 10 kN/m → MB = −qL²/8", () => {
  const r = vigaContinua2Vaos(6, 10, 6, 10, 45000);
  near(r.MB, -45, 1e-9, "MB");
  near(r.RA, 22.5, 1e-9, "RA");
  near(r.RC, 22.5, 1e-9, "RC");
  near(r.RB, 75, 1e-9, "RB");
  near(r.M1, 25.3125, 1e-9, "M+ vão 1");
  near(r.M2, 25.3125, 1e-9, "M+ vão 2");
});

test("A4: flecha máxima vão simétrico = qL⁴/(185EI)", () => {
  const r = vigaContinua2Vaos(6, 10, 6, 10, 45000);
  near(r.f1.d * 1000, (10 * 6 ** 4) / (185 * 45000) * 1000, 0.01, "δ máx (mm)");
  near(r.f1.x, 0.4215 * 6, 0.03, "posição da flecha máx");
});

test("A: vãos diferentes — equilíbrio global e M(L1) = MB", () => {
  const r = vigaContinua2Vaos(7, 25, 5.5, 18, 45000);
  near(r.RA + r.RB + r.RC, 25 * 7 + 18 * 5.5, 1e-9, "ΣR");
  near(r.RA * 7 - (25 * 49) / 2, r.MB, 1e-9, "M no apoio B pelo vão 1");
  near(r.MB, -(25 * 343 + 18 * 166.375) / (8 * 12.5), 1e-9, "MB");
});

/* ── B. Viga CA ── */
test("B: viga CA exemplo (L=6, 25×60, C25, CA-50, gk=20, qk=15)", () => {
  const out = calculate("civil", "concreto", { L: 6, bw: 25, h: 60, cob: 3, fck: 25, fyk: 500, gk: 20, qk: 15 }).val;
  near(num(grab(out, /^Md =/), /= ([\d.]+) kN·m/), 220.5, 0.01, "Md");
  near(num(grab(out, /^Kmd =/), /Kmd = ([\d.]+)/), 0.1611, 0.0002, "Kmd");
  near(num(grab(out, /^As calculada/), /([\d.]+) cm²/), 10.25, 0.01, "As");
  near(num(grab(out, /^As mínima/), /([\d.]+) cm²/), 2.25, 0.01, "As,mín = 0,15%·bw·h");
  near(num(grab(out, /^Vc =/), /= ([\d.]+) kN/), 106.52, 0.05, "Vc");
  near(num(grab(out, /^Asw\/s mínimo/), /([\d.]+) cm²\/m/), 2.56, 0.01, "Asw,mín");
  assert.match(out, /✓ Vsd ≤ Vrd2/);
});

test("B1: limite Kmd = 0,251 (x/d = 0,45)", () => {
  near(KMD_LIM, 0.2509, 0.0001);
  assert.throws(() => calculate("civil", "concreto", { L: 8, bw: 15, h: 40, cob: 3, fck: 20, fyk: 500, gk: 30, qk: 20 }), /Kmd/);
});

test("B3: ρmín da Tab. 17.3", () => {
  near(rhoMinFlexao(25), 0.0015, 1e-9);
  near(rhoMinFlexao(40), 0.00179, 1e-9);
});

/* ── C. Sapata ── */
test("C3: pressão triangular σmáx = 2N/(3B(A/2 − e))", () => {
  const p = pressaoSolo(800, 320, 2, 2); // e = 0,4 > A/6
  assert.equal(p.triangular, true);
  near(p.sigMax, (2 * 800) / (3 * 2 * 0.6), 1e-9);
});

test("C: sapata centrada 800 kN, pilar 40×40, σadm 200 kPa", () => {
  const out = calculate("civil", "fundacao", { Nk: 800, Mk: 0, ap: 40, bp: 40, sigAd: 200, fck: 25, fyk: 500, cobs: 5, hs: null }).val;
  assert.match(out, /A × B = 2\.05 × 2\.05 m/);
  assert.match(out, /h mínimo \(rígida\) = \(A − a\)\/3 = 0\.55 m/);
  near(num(grab(out, /^u₀ =/), /= ([\d.]+) m/), 1.6, 1e-9, "u0 = 2(a+b)");
  assert.match(out, /✓ σmáx ≤ σadm/);
});

test("C1: h informado pequeno → adota h mínimo (não reduz a sapata)", () => {
  const out = calculate("civil", "fundacao", { Nk: 800, Mk: 0, ap: 40, bp: 40, sigAd: 200, fck: 25, fyk: 500, cobs: 5, hs: 30 }).val;
  assert.match(out, /A × B = 2\.05 × 2\.05 m/);
  assert.match(out, /✗ h informado 0\.30 m < h mín — ADOTADO h = 0\.55 m/);
});

test("C6: pilar retangular → balanços iguais (A − B = a − b)", () => {
  const out = calculate("civil", "fundacao", { Nk: 1000, Mk: 0, ap: 60, bp: 20, sigAd: 250, fck: 25, fyk: 500, cobs: 5 }).val;
  const m = out.match(/A × B = ([\d.]+) × ([\d.]+) m/)!;
  near(Number(m[1]) - Number(m[2]), 0.4, 0.051, "A − B");
});

/* ── D. Pilar ── */
test("D1: compressão centrada — As = (N − 0,85·fcd·Ac)/σs(2‰)", () => {
  const s = { b: 400, h: 400, dl: 40, fcd: fcd(30), fyd: fyd(500) };
  const r = armaduraFlexoCompressao(s, 3700e3, 1, 12800)!;
  near(r.As, (3700e3 - 0.85 * s.fcd * 160000) / 420, 2, "As (mm²)");
});

test("D1: equilíbrio da seção devolve (N, M) consistentes", () => {
  const s = { b: 250, h: 500, dl: 40, fcd: fcd(30), fyd: fyd(500) };
  const r = armaduraFlexoCompressao(s, 1500e3, 250e6, 10000)!;
  const back = momentoResistente(s, 1500e3, r.As)!;
  near(back.N, 1500e3, 1, "N");
  assert.ok(back.M >= 250e6 - 1e3, "MRd ≥ Md");
});

test("D3: momento mínimo Nd·(0,015 + 0,03h)", () => {
  const out = calculate("civil", "resistencia", { Nd: 1500, M1d: 0, lc: 3, beta: 1, bP: 25, hP: 50, fck: 30, fyk: 500 }).val;
  near(num(grab(out, /M1d,mín = Nd·\(0,015 \+ 0,03·h\)/), /= ([\d.]+) kN·m →/), 1500 * (0.015 + 0.03 * 0.5), 0.01, "M1d,mín h");
});

test("D2: direção b (menor) é a crítica para pilar alongado sem momento", () => {
  const out = calculate("civil", "resistencia", { Nd: 1500, M1d: 0, lc: 3, beta: 1, bP: 25, hP: 50, fck: 30, fyk: 500 }).val;
  near(num(grab(out, /^λ = le·√12\/b/), /= ([\d.]+)/), (3 * Math.sqrt(12)) / 0.25, 0.1, "λb");
  assert.match(out, /Direção crítica: b/);
});

test("D5: λ > 90 bloqueia o método da curvatura", () => {
  assert.throws(() => calculate("civil", "resistencia", { Nd: 500, M1d: 0, lc: 7, beta: 1, bP: 20, hP: 40, fck: 30, fyk: 500 }), /λb .* > 90/);
});

/* ── E. Drenagem ── */
test("E1: Kirpich L=300 m, S=0,02 → 7,10 min", () => near(kirpich(300, 0.02), 7.104, 0.01));

test("E2: seção circular — y/D = 0,5 escoa metade da vazão plena", () => {
  const full = vazaoCircular(0.6, 1, 0.013, 0.01).Q;
  near(vazaoCircular(0.6, 0.5, 0.013, 0.01).Q / full, 0.5, 1e-9);
  near(laminaParaVazao(0.6, full / 2, 0.013, 0.01)!, 0.5, 1e-6);
  near(vazaoCircular(0.6, 0.938, 0.013, 0.01).Q / full, 1.076, 0.002, "Q máx");
  near(secaoCircularParcial(1, 1).Rh, 0.25, 1e-9);
});

test("E3: diâmetro de seção plena em forma fechada", () => {
  const D = diametroSecaoPlena(0.5, 0.013, 0.01);
  near(vazaoCircular(D, 1, 0.013, 0.01).Q, 0.5, 1e-9);
});

test("E: predial — A = (a + h/2)·b e Q = I·A/60", () => {
  const out = calculate("civil", "tubos", { I: 150, a: 5, hT: 1.5, b: 12, nCond: 1, mat: "0.011", wC: 15, sC: 0.5, sH: 1 }).val;
  assert.match(out, /= 69\.00 m²/);
  assert.match(out, /Q = I·A\/60 = 172\.5 L\/min/);
  assert.match(out, /✓ Adotar DN/);
});

test("E: rede urbana — lâmina ≤ 80% no DN adotado", () => {
  const out = calculate("civil", "rede_urbana", { A: 2.5, C: 0.85, i: 120, L: 300, S: 0.02, nMn: 0.013, Dc: 600 }).val;
  assert.match(out, /tc \(Kirpich\) = 7\.1 min/);
  const lam = num(grab(out, /^DN adotado/), /lâmina ([\d.]+) %/);
  assert.ok(lam <= 80);
});
