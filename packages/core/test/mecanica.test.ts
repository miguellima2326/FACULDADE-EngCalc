/** Testes de aceitação — spec 010 (Mecânica). Valores de referência calculados à mão. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeValues } from "../src/index.js";
import {
  MECANICA, diametroEixo, verificaEixo, kbDe, MATERIAIS_EIXO, ACABAMENTOS, ROSCAS, propriedadesClasse,
  geometriaEngrenagem, zMinTeorico,
} from "../src/mecanica.js";

const near = (a: number, e: number, tol: number, msg = "") => assert.ok(Math.abs(a - e) <= tol, `${msg} esperado ${e} ± ${tol}, obtido ${a}`);
const byId = (id: string) => (MECANICA.calcs as any[]).find((c) => c.id === id);
const run = (id: string, values: Record<string, unknown>) => { const c = byId(id); return c.calc(normalizeValues(c, values as any)); };

/* ── estrutura / convenções §7 ── */
test("MECANICA tem os 7 originais + eixo, parafuso, engrenagem", () => {
  const ids = (MECANICA.calcs as any[]).map((c) => c.id);
  for (const id of ["rpm", "conv", "polia", "avanco", "cone", "tensao", "potencia", "dilatacao", "eixo", "parafuso", "engrenagem"]) assert.ok(ids.includes(id), id);
  assert.ok(byId("rpm").diagram.includes("<svg"));
});

test("§7: todo cálculo tem example que roda sem erro; units começa pela unidade-base", () => {
  for (const c of MECANICA.calcs as any[]) {
    assert.ok(c.example, `${c.id} sem example`);
    assert.doesNotThrow(() => c.calc(normalizeValues(c, c.example)), `${c.id} falhou com o example`);
    for (const f of c.fields) if (f.units) assert.equal(f.units[0].factor, 1, `${c.id}.${f.id}: 1ª unidade deve ser a base`);
  }
});

/* ── originais preservados ── */
test("originais: RPM, polia, cone, potência inalterados", () => {
  assert.equal(run("rpm", { vc: 80, d: 50 }).val, "509.3");
  assert.equal(run("polia", { d1: 100, n1: 1200, d2: 200 }).val, "600.0");
  near(Number(run("cone", { d1c: 60, d2c: 40, lc: 100 }).val), (Math.atan(0.1) * 180) / Math.PI, 1e-4);
  assert.match(run("potencia", { t: 50, n: 1450 }).val, /7592\.18 W\s+=\s+7\.592 kW\s+=\s+10\.32 cv/);
  assert.match(run("conv", { mm: 25.39 }).val, /≈ 1"/);
});

/* ── M1 Eixo ── */
test("M1: só torque → d = [(16n/π)·√3·Kfs·T/Sy]^(1/3) (independe de Se)", () => {
  const Sy = 530, T = 200e3, Kfs = 1.5, n = 2;
  const esperado = Math.cbrt((16 * n / Math.PI) * Math.sqrt(3) * Kfs * T / Sy); // ≈ 21,53 mm
  const r = diametroEixo({ M: 0, T, Sut: 630, Sy, ka: 0.8, ke: 0.814, Kf: 1.7, Kfs, n });
  near(r.d, esperado, 1e-6, "d");
  near(esperado, 21.53, 0.01, "valor à mão");
});

test("M1: flexão + torção — ponto fixo com kb(d) e n_fadiga(d mín) = n", () => {
  const m = MATERIAIS_EIXO["1045"], ac = ACABAMENTOS.usinado;
  const ka = ac.a * Math.pow(m.Sut, ac.b);
  near(ka, 0.8173, 0.0005, "ka 1045 usinado");
  const p = { M: 150e3, T: 200e3, Sut: m.Sut, Sy: m.Sy, ka, ke: 0.814, Kf: 1.7, Kfs: 1.5, n: 2 };
  const r = diametroEixo(p);
  // conferência independente: com o kb final, a fórmula fecha em d
  const Se = ka * kbDe(r.d) * 0.814 * 0.5 * m.Sut;
  const d2 = Math.cbrt((16 * 2 / Math.PI) * Math.sqrt(4 * (1.7 * 150e3 / Se) ** 2 + 3 * (1.5 * 200e3 / m.Sy) ** 2));
  near(r.d, d2, 1e-4, "ponto fixo");
  near(verificaEixo({ ...p, d: r.d }).nFad, 2, 1e-4, "n fadiga no d mínimo");
  assert.ok(r.d > 25 && r.d < 40, `d plausível (${r.d})`);
});

test("M1: relatório sugere diâmetro comercial ≥ d mínimo", () => {
  const out = run("eixo", { mat: "1045", acab: "usinado", conf: "99", M: 150, T: 200, Kf: 1.7, Kfs: 1.5, n: 2 }).val;
  const dMin = Number(out.match(/d mínimo = ([\d.]+) mm/)![1]);
  const dCom = Number(out.match(/diâmetro comercial sugerido: (\d+) mm/)![1]);
  assert.ok(dCom >= dMin);
  assert.match(out, /n fadiga = [\d.]+ ✓/);
});

/* ── M2 Parafuso ── */
test("M2: tabela ISO — M10 At 58,0 · M20 At 245 · passos", () => {
  assert.equal(ROSCAS.M10.At, 58.0); assert.equal(ROSCAS.M10.p, 1.5);
  assert.equal(ROSCAS.M20.At, 245); assert.equal(ROSCAS.M20.p, 2.5);
});

test("M2: M10 8.8 (Sp 580, d ≤ 16) → Fi = 25,23 kN, T(K=0,2) = 50,5 N·m", () => {
  assert.equal(propriedadesClasse("8.8", 10).Sp, 580);
  const out = run("parafuso", { rosca: "M10", classe: "8.8", uniao: "0.75", K: "0.20" }).val;
  assert.match(out, /Fi = 0\.75·Fp = 25\.23 kN/);   // 0,75·58·580 = 25 230 N
  assert.match(out, /= 50\.5 N·m/);                 // 0,2·25 230·0,010
});

test("M2: M20 8.8 (Sp 600) → Fi = 110,25 kN, T = 441,0 N·m; 10.9 e permanente", () => {
  let out = run("parafuso", { rosca: "M20", classe: "8.8", uniao: "0.75", K: "0.20" }).val;
  assert.match(out, /Fi = 0\.75·Fp = 110\.25 kN/);  // 0,75·245·600
  assert.match(out, /= 441\.0 N·m/);                // 0,2·110 250·0,020
  out = run("parafuso", { rosca: "M12", classe: "10.9", uniao: "0.90", K: "0.18" }).val;
  assert.match(out, /Fi = 0\.90·Fp = 62\.97 kN/);   // 0,9·84,3·830 = 62 972
});

test("M2: carga externa ≥ Fi alerta separação", () => {
  const out = run("parafuso", { rosca: "M10", classe: "8.8", uniao: "0.75", K: "0.20", P: 30 }).val;
  assert.match(out, /✗ P ≥ Fi/);
});

/* ── M3 Engrenagem ── */
test("M3: m=2, Z1=20, Z2=40 → d1=40, d2=80, a=60, i=2", () => {
  const g = geometriaEngrenagem(2, 20, 40, 20);
  assert.equal(g.d1, 40); assert.equal(g.d2, 80); assert.equal(g.dist, 60); assert.equal(g.i, 2);
  assert.equal(g.da1, 44); assert.equal(g.df1, 35);
  near(g.db1, 40 * Math.cos((20 * Math.PI) / 180), 1e-9);
});

test("M3: Zmín teórico 20° ≈ 17,1; 14,5° ≈ 31,9; alerta interferência", () => {
  near(zMinTeorico(20), 17.097, 0.001);
  near(zMinTeorico(14.5), 31.9, 0.1);
  assert.match(run("engrenagem", { m: 2, Z1: 20, Z2: 40, alpha: "20" }).val, /✓ Z1 = 20 ≥ 17/);
  assert.match(run("engrenagem", { m: 2, Z1: 12, Z2: 40, alpha: "20" }).val, /⚠ Z1 = 12 < 17/);
  assert.match(run("engrenagem", { m: 2.2, Z1: 20, Z2: 40, alpha: "20" }).val, /⚠ módulo fora/);
  assert.match(run("engrenagem", { m: 2, Z1: 20, Z2: 40, alpha: "20", n1: 1750 }).val, /n2 = n1\/i = 875\.0 rpm/);
});
