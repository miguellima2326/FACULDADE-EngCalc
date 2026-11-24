/**
 * Testes de aceitação — spec 009 (novos cálculos civis) e convenções da constituição §7
 * (example, units, links) nos cálculos civis. Referências calculadas à mão.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, DATA } from "../src/index.js";
import { idfIntensidade, IDF_PRESETS, lajeMarcus, flechaVigaCA, xiFluencia, ancoragem, consumoCimento } from "../src/civil.js";

const near = (a: number, e: number, tol: number, msg = "") =>
  assert.ok(Math.abs(a - e) <= tol, `${msg} esperado ${e} ± ${tol}, obtido ${a}`);
const civil = (DATA as any).civil.calcs as any[];
const byId = (id: string) => civil.find((c) => c.id === id);

/* ── convenções §7 ── */
test("§7: todo cálculo civil tem example que roda sem erro", () => {
  for (const c of civil) {
    assert.ok(c.example, `${c.id} sem example`);
    assert.doesNotThrow(() => calculate("civil", c.id, c.example), `${c.id}: example falhou`);
  }
});

test("§7: units — 1º item é a unidade-base igual ao hint", () => {
  for (const c of civil) for (const f of c.fields) if (f.units) {
    assert.equal(f.units[0].value, f.hint, `${c.id}.${f.id}`);
    assert.equal(f.units[0].factor, 1, `${c.id}.${f.id}`);
  }
  const q1 = byId("deflexao").fields.find((f: any) => f.id === "q1");
  near(2 * q1.units.find((u: any) => u.value === "tf/m").factor, 19.6133, 1e-4, "2 tf/m em kN/m");
});

test("§7: links apontam para cálculos e campos existentes e o destino roda", () => {
  for (const c of civil) {
    const r: any = calculate("civil", c.id, c.example);
    for (const l of r.links ?? []) {
      const dest = (DATA as any)[l.area].calcs.find((d: any) => d.id === l.calcId);
      assert.ok(dest, `${c.id} → ${l.calcId} inexistente`);
      for (const k of Object.keys(l.values)) assert.ok(dest.fields.some((f: any) => f.id === k), `${c.id} → ${l.calcId}: campo ${k} inexistente`);
      assert.doesNotThrow(() => calculate(l.area, l.calcId, l.values), `${c.id} → ${l.calcId} falhou`);
    }
  }
});

/* ── spec 006 (parte civil) ── */
test("E1: viga contínua → viga CA com Md,inf = 1,4·|M_B|", () => {
  const r: any = calculate("civil", "deflexao", { L1: 6, q1: 10, L2: 6, q2: 10, EI: 45000 });
  const l = r.links.find((x: any) => x.calcId === "concreto" && /apoio B/.test(x.label));
  near(l.values.Mdinf, 63, 1e-9, "1,4·45");
  const out = calculate("civil", "concreto", l.values).val;
  assert.match(out, /Md = Md,inf \(informado\) = 63\.00 kN·m/);
});

test("E2/E3: reação central → sapata; pilar → sapata com Nk = Nd/1,4", () => {
  const r: any = calculate("civil", "deflexao", { L1: 6, q1: 10, L2: 6, q2: 10, EI: 45000 });
  assert.equal(r.links.find((x: any) => x.calcId === "fundacao").values.Nk, 75);
  const p: any = calculate("civil", "resistencia", { Nd: 1400, M1d: 0, lc: 3, beta: 1, bP: 25, hP: 50, fck: 30, fyk: 500 });
  const s = p.links[0].values;
  assert.equal(s.Nk, 1000); assert.equal(s.ap, 50); assert.equal(s.bp, 25);
});

/* ── C1 IDF ── */
test("C1: i = K·T^a/(t+b)^c — São Paulo T=10, t=10 → 151,1 mm/h", () => {
  const p = IDF_PRESETS.sp;
  near(idfIntensidade(p.K, p.a, p.b, p.c, 10, 10), 151.13, 0.05);
  const out = calculate("civil", "idf", { cidade: "personalizado", K: 1747.9, a: 0.181, b: 15, c: 0.89, T: 10, t: 10 }).val;
  assert.match(out, /i = 151\.1 mm\/h/);
  assert.throws(() => calculate("civil", "idf", { cidade: "personalizado", T: 10, t: 10 }), /Preencha/);
});

/* ── C2 Laje ── */
test("C2: Marcus — laje quadrada 4 bordas apoiadas: kx = 0,5 e Mx = 0,5·p·l²/8·(1 − 20/3·0,5/8)", () => {
  const r = lajeMarcus(4, 4, 10, "AA", "AA");
  near(r.kx, 0.5, 1e-12);
  near(r.Mx, 5.8333, 1e-4);
  near(r.My, r.Mx, 1e-12);
});

test("C2: Marcus — engastes geram negativos X = k·p·l²/n e λ > 2 vira uma direção", () => {
  const r = lajeMarcus(4, 4, 10, "EE", "EE");
  near(r.Xx, (0.5 * 10 * 16) / 12, 1e-9);
  const u = lajeMarcus(3, 7, 10, "AA", "AA");
  assert.equal(u.umaDirecao, true);
  near(u.Mx, (10 * 9) / 8, 1e-12);
});

test("C2: relatório da laje — h mínimo e armadura mínima positiva 0,67·ρmín", () => {
  const out = calculate("civil", "laje", { lx: 4, ly: 5, bx: "AA", by: "AA", h: 7, grev: 1, q: 2, uso: "piso", fck: 25, fyk: 500, cob: 2.5 }).val;
  assert.match(out, /✗ h = 7 cm < h,mín = 8 cm/);
  assert.throws(() => calculate("civil", "laje", { lx: 5, ly: 4, bx: "AA", by: "AA", h: 10, grev: 1, q: 2, uso: "piso", fck: 25, fyk: 500, cob: 2.5 }), /MENOR vão/);
});

/* ── C3 Flecha ── */
test("C3: ξ(t) e αf (t0 = 1 mês, sem As') = 2 − 0,68·0,996·1 = 1,3227", () => {
  near(xiFluencia(1), 0.68 * 0.996, 1e-12);
  const r = flechaVigaCA({ L: 6, bw: 25, h: 60, cob: 3, fck: 25, As: 10.25, gk: 20, qk: 15 });
  near(r.af, 2 - 0.68 * 0.996, 1e-9);
});

test("C3: flecha — valores da viga exemplo conferidos à mão", () => {
  const r = flechaVigaCA({ L: 6, bw: 25, h: 60, cob: 3, fck: 25, As: 10.25, gk: 20, qk: 15 });
  // Ecs = 0,8625·5600·5 = 24150 MPa ; Ic = 25·60³/12 = 450000 cm⁴ ; fct,m = 2,5649 MPa
  near(r.Ecs, 24150, 1e-6, "Ecs");
  near(r.Ic, 450000, 1e-6, "Ic");
  near(r.Mr, (1.5 * 0.3 * 25 ** (2 / 3) * 450000e4) / 300 / 1e6, 1e-9, "Mr");
  near(r.pqp, 24.5, 1e-12, "pqp = 20 + 0,3·15");
  near(r.Ma, 110.25, 1e-9, "Ma");
  // x_II pela equação do 2º grau com αe = 210000/24150
  const ae = 210000 / 24150, d = 60 - 3 - 0.63 - 1;
  const x = (-ae * 10.25 + Math.sqrt((ae * 10.25) ** 2 + 4 * 12.5 * ae * 10.25 * d)) / (2 * 12.5);
  near(r.x, x, 1e-9, "x_II");
  assert.ok(r.Ieq < r.Ic && r.Ieq > r.III, "Ieq entre III e Ic");
  near(r.d0, (5 * 24.5 * 6 ** 4) / (384 * r.EI) * 1000, 1e-9, "δ0");
  near(r.dt, r.d0 * (1 + r.af), 1e-12, "δ∞");
});

/* ── C4 Ancoragem ── */
test("C4: φ16, C25, CA-50, boa aderência → fbd = 2,886 MPa e lb = 60,3 cm (37,7φ)", () => {
  const r = ancoragem({ phi: 16, fck: 25, fyk: 500 });
  near(r.fbd, 2.8856, 1e-4);
  near(r.lb, 602.70, 0.05);
  near(r.l0t, 1.8 * 602.70, 0.1, "l0t = 1,8·lb");
  const g = ancoragem({ phi: 16, fck: 25, fyk: 500, gancho: true, AsCalc: 5, AsEf: 10 });
  near(g.lbnec, Math.max(0.7 * 602.70 * 0.5, 0.3 * 602.70, 160, 100), 0.05, "lb,nec com gancho e As,ef");
});

test("C4: má aderência reduz fbd para 70%", () => {
  near(ancoragem({ phi: 16, fck: 25, fyk: 500, boa: false }).fbd, 0.7 * 2.8856, 1e-4);
});

/* ── C5 Materiais ── */
test("C5: traço 1:2:3, a/c 0,55 → C = 365,9 kg/m³; viga 6 m × 20 × 50", () => {
  near(consumoCimento(2, 3, 0.55), 365.86, 0.01);
  const out = calculate("civil", "materiais", { elem: "viga", c: 6, b: 20, h: 50, n: 1, a: 2, p: 3, ac: 0.55 }).val;
  assert.match(out, /= 0\.600 m³/);           // 6·0,2·0,5
  assert.match(out, /Área de forma = 7\.20 m²/); // (2·0,5 + 0,2)·6
  assert.match(out, /→ 60\.0 kg/);               // 100 kg/m³ · 0,6
});
