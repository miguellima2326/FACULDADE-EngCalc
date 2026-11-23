import { test } from "node:test";
import assert from "node:assert/strict";
import { ELETRICA, correnteNominal, quedaTensaoPct, secaoCurto, secaoComercial } from "../src/eletrica.js";
import { fatorInstalacao } from "../src/lib/nbr5410.js";

const close = (a: number, b: number, tol: number, msg?: string) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""} esperado ${b} ± ${tol}, obtido ${a}`);

const calc = (id: string) => ELETRICA.calcs.find((c) => c.id === id)!;

const base = { nivel: "BT" as const, nCircuitos: 1, resSolo: 2.5, profundidade: 0.7 };

test("Tab. 40 — XLPE ao ar 40 °C → Kt 0,91", () => {
  close(fatorInstalacao({ ...base, isolacao: "xlpe", instalacao: "ao_ar", temp: 40 }).Kt, 0.91, 1e-9);
});

test("Tab. 40 — PVC ao ar 40 °C → Kt 0,87", () => {
  close(fatorInstalacao({ ...base, isolacao: "pvc", instalacao: "ao_ar", temp: 40 }).Kt, 0.87, 1e-9);
});

test("Tab. 40 — XLPE no solo 30 °C → Kt 0,93", () => {
  close(fatorInstalacao({ ...base, isolacao: "xlpe", instalacao: "enterrado_direto", temp: 30 }).Kt, 0.93, 1e-9);
});

test("Tab. 41 — resistividade 1,5 K·m/W, diretamente enterrado → Ks 1,28", () => {
  close(fatorInstalacao({ ...base, isolacao: "xlpe", instalacao: "enterrado_direto", temp: 20, resSolo: 1.5 }).Ks, 1.28, 1e-9);
});

test("Tab. 44 — 3 circuitos diretamente enterrados encostados → Kg 0,65", () => {
  const r = fatorInstalacao({ ...base, isolacao: "xlpe", instalacao: "enterrado_direto", temp: 20, nCircuitos: 3, espacamento: "encostados" });
  close(r.Kg, 0.65, 1e-9);
});

test("BT enterrado não aplica fator de profundidade; MT aplica", () => {
  const common = { isolacao: "xlpe" as const, instalacao: "enterrado_direto" as const, temp: 20, resSolo: 2.5, profundidade: 1.5, nCircuitos: 1 };
  assert.equal(fatorInstalacao({ ...common, nivel: "BT" }).Kp, 1);
  close(fatorInstalacao({ ...common, nivel: "MT" }).Kp, 0.93, 1e-9);
});

test("Espaçamento inexistente na tabela usa o mais próximo com aviso", () => {
  const r = fatorInstalacao({ ...base, isolacao: "xlpe", instalacao: "enterrado_duto", temp: 20, nCircuitos: 2, espacamento: "0.125" });
  assert.ok(r.avisos.some((a) => a.includes("não existe")));
});

test("Fc = 1/(Kt·Ks·Kp·Kg)", () => {
  const r = fatorInstalacao({ ...base, isolacao: "pvc", instalacao: "ao_ar", temp: 40, nCircuitos: 3 });
  close(r.Fc, 1 / (0.87 * 0.70), 1e-9);
});

test("In 2000 kVA / 4160 V = 277,57 A", () => {
  close(correnteNominal(2000, 4160), 277.57, 0.01);
});

test("ΔV% = K·L·In/(10·V) — K 0,15, L 115 m → 0,1151 %", () => {
  close(quedaTensaoPct(0.15, 115, correnteNominal(2000, 4160), 4160), 0.1151, 0.0001);
});

test("Curto: Icc 25 kA, t 0,5 s, k 115 → Smín 153,7 mm² → 185 mm²", () => {
  const S = secaoCurto(25000, 0.5, 115);
  close(S, 153.7, 0.05);
  assert.equal(secaoComercial(S), 185);
});

test("Curto-circuito com Sesc vazio não quebra e recomenda 185 mm²", () => {
  const r = calc("curto_circuito").calc({ Icc: 25, t: 0.5, material: "cu_pvc", k: undefined, Sesc: undefined });
  assert.match(r.val, /185 mm²/);
  assert.match(r.val, /não informada/);
});

test("Cabo MT sem cabo candidato gera requisitos", () => {
  const r = calc("cabo_mt").calc({ S: 2000, V: 4160, isolacao: "xlpe", instalacao: "ao_ar", tempSolo: 30, nCircuitos: 1, L: 115, K: 0.15, dVadm: 4 });
  assert.match(r.val, /Iz mínimo necessário: 277\.57 A/);
});

test("Cabo BT com candidato informa fator determinante", () => {
  const r = calc("cabo_bt").calc({ S: 2000, V: 460, isolacao: "xlpe", instalacao: "ao_ar", tempSolo: 35, nCircuitos: 6, Np: 6, L: 115, K: 0.21, dVadm: 4, Sesc: 240, Iz: 607 });
  assert.match(r.val, /Fator determinante/);
});

test("Cabo BT: Sesc sem Iz → erro", () => {
  assert.throws(() => calc("cabo_bt").calc({ S: 2000, V: 460, isolacao: "xlpe", instalacao: "ao_ar", tempSolo: 35, nCircuitos: 6, Np: 6, L: 115, K: 0.21, dVadm: 4, Sesc: 240 }), /Iz/);
});
