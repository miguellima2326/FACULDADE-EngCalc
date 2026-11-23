/** Testes de aceitação — spec 001, blocos G (Mecânica) e H (plataforma). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, DATA } from "../src/index.js";

test("H1: campo obrigatório vazio é erro (não vira 0)", () => {
  assert.throws(() => calculate("mecanica", "rpm", { vc: 80, d: null }), /Preencha o campo/);
  assert.throws(() => calculate("mecanica", "rpm", { vc: "", d: 50 }), /Preencha o campo/);
});

test("H1: vírgula decimal é aceita", () => {
  assert.equal(calculate("mecanica", "rpm", { vc: "80", d: "50,0" }).val, "509.3");
});

test("H: todo cálculo tem fórmula, contexto e roda com os placeholders", () => {
  for (const [area, def] of Object.entries(DATA) as [string, any][]) {
    for (const c of def.calcs) {
      assert.ok(c.formula, `${c.id} sem fórmula`);
      assert.ok(c.context, `${c.id} sem contexto`);
      const values: Record<string, string | null> = {};
      for (const f of c.fields) values[f.id] = f.type === "select" ? null : (f.ph ?? null) || null;
      assert.doesNotThrow(() => calculate(area, c.id, values), `${area}/${c.id} falhou com os valores de exemplo`);
    }
  }
});

test("G1: fração que arredonda para 1 soma na parte inteira", () => {
  const out = calculate("mecanica", "conv", { mm: 25.39 }).val;
  assert.match(out, /≈ 1"/);
  assert.doesNotMatch(out, /1\/1/);
});

test("G2: potência em W, kW e cv", () => {
  const out = calculate("mecanica", "potencia", { t: 50, n: 1450 }).val;
  assert.match(out, /7592\.18 W\s+=\s+7\.592 kW\s+=\s+10\.32 cv/);
});
