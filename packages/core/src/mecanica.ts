// @ts-nocheck
/**
 * MECÂNICA — spec 010 + convenções da constituição §7 (example, units, links).
 * Os 7 cálculos originais (migrados de data.ts, mesmo comportamento) + eixo, parafuso e engrenagem.
 */

const fx = (x, d = 2) => Number(x).toFixed(d);
const pos = (v, nome) => { if (!(v > 0)) throw new Error(`${nome} deve ser > 0`); };

/* Unidades alternativas (constituição §7 — primeiro item = unidade-base) */
const U_MM = [{ value: "mm", factor: 1 }, { value: "in", factor: 25.4 }];
const U_FORCA_N = [{ value: "N", factor: 1 }, { value: "kN", factor: 1000 }, { value: "kgf", factor: 9.80665 }];
const U_TORQUE = [{ value: "N·m", factor: 1 }, { value: "kgf·m", factor: 9.80665 }];

/* ═══════════ M1 — Eixo (Shigley, DE-ASME elíptico) ═══════════ */

/** Materiais típicos — Shigley Tab. A-20/A-21 (valores mínimos típicos) [CONFIRMAR com certificado do aço]. */
export const MATERIAIS_EIXO = {
  "1020": { label: "SAE 1020 laminado a quente", Sut: 380, Sy: 210 },
  "1045": { label: "SAE 1045 estirado a frio", Sut: 630, Sy: 530 },
  "4140": { label: "SAE 4140 temperado e revenido (650 °C)", Sut: 758, Sy: 655 },
};

/** Fator de superfície de Marin ka = a·Sut^b (Shigley Tab. 6-2, Sut em MPa). */
export const ACABAMENTOS = {
  retificado: { label: "Retificado", a: 1.58, b: -0.085 },
  usinado: { label: "Usinado ou estirado a frio", a: 4.51, b: -0.265 },
  laminado: { label: "Laminado a quente", a: 57.7, b: -0.718 },
  forjado: { label: "Forjado", a: 272, b: -0.995 },
};

/** Fator de confiabilidade ke (Shigley Tab. 6-5). */
export const CONFIABILIDADE = { "50": 1.0, "90": 0.897, "95": 0.868, "99": 0.814, "99.9": 0.753 };

/** Fator de tamanho kb para flexão/torção rotativa (Shigley eq. 6-20), d em mm. */
export const kbDe = (d) => (d <= 51 ? 1.24 * Math.pow(d, -0.107) : 1.51 * Math.pow(d, -0.157));

/** Diâmetros comerciais de eixo (mm). */
const DIAM_EIXO = [10, 12, 15, 17, 20, 22, 25, 28, 30, 32, 35, 38, 40, 42, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 110, 120, 130, 140, 150, 160, 180, 200, 220, 250];

/**
 * DE-ASME elíptico (Shigley eq. 7-12) para eixo rotativo com momento fletor alternado (Ma = M)
 * e torque constante (Tm = T): d = [ (16n/π)·√( 4(Kf·M/Se)² + 3(Kfs·T/Sy)² ) ]^(1/3).
 * M e T em N·mm, tensões em MPa → d em mm. kb depende de d → iteração de ponto fixo.
 */
export function diametroEixo({ M, T, Sut, Sy, ka, ke, Kf, Kfs, n }) {
  const SeLinha = Sut <= 1400 ? 0.5 * Sut : 700;
  let kb = 0.9, d = 0, Se = 0;
  for (let i = 0; i < 50; i++) {
    Se = ka * kb * 1 * 1 * ke * SeLinha; // kc = 1 (flexão), kd = 1 (temperatura ambiente)
    const dNovo = Math.cbrt(((16 * n) / Math.PI) * Math.sqrt(4 * (Kf * M / Se) ** 2 + 3 * (Kfs * T / Sy) ** 2));
    const conv = Math.abs(dNovo - d) < 1e-6;
    d = dNovo;
    kb = Math.min(1, kbDe(Math.max(d, 2.79)));
    if (conv) break;
  }
  return { d, Se, SeLinha, kb };
}

/** Fator de segurança à fadiga (DE-ASME) e von Mises máximo para um diâmetro d (mm). */
export function verificaEixo({ d, M, T, Sut, Sy, ka, ke, Kf, Kfs }) {
  const kb = Math.min(1, kbDe(Math.max(d, 2.79)));
  const Se = ka * kb * ke * (Sut <= 1400 ? 0.5 * Sut : 700);
  const nFad = 1 / ((16 / (Math.PI * d ** 3)) * Math.sqrt(4 * (Kf * M / Se) ** 2 + 3 * (Kfs * T / Sy) ** 2));
  const sigma = (32 * Kf * M) / (Math.PI * d ** 3);
  const tau = (16 * Kfs * T) / (Math.PI * d ** 3);
  const vm = Math.sqrt(sigma ** 2 + 3 * tau ** 2);
  return { kb, Se, nFad, sigma, tau, vm, nEsc: Sy / vm };
}

const eixo = {
  id: "eixo",
  icon: "rotate",
  name: "Dimensionamento de Eixo — Fadiga (DE-ASME)",
  desc: "diâmetro mínimo por flexão alternada + torção, Marin e von Mises",
  norma: "ASME B106.1M / Shigley",
  formula:
    "Se' = 0,5·Sut | ka = a·Sut^b | kb = 1,24·d^−0,107 (d ≤ 51 mm) | Se = ka·kb·kc·kd·ke·Se' | " +
    "d = [ (16n/π)·√( 4(Kf·M/Se)² + 3(Kfs·T/Sy)² ) ]^(1/3) | σ' = √( (32Kf·M/πd³)² + 3(16Kfs·T/πd³)² ) ≤ Sy",
  context:
    "Diâmetro mínimo de um eixo rotativo de aço submetido a momento fletor (que se torna alternado com a rotação) e torque constante, pelo critério DE-ASME elíptico (Shigley, eq. 7-12 — critério de Von Mises combinado à elipse ASME de fadiga). O limite de resistência à fadiga Se é corrigido pelos fatores de Marin: superfície (ka, pelo acabamento), tamanho (kb, depende do próprio diâmetro — por isso o cálculo é iterativo), carregamento kc = 1 (flexão), temperatura kd = 1 (ambiente) e confiabilidade ke. Kf e Kfs são os fatores de concentração de tensão em fadiga no ponto crítico (rasgo de chaveta ≈ 2,2/3,0; ombro com raio generoso ≈ 1,7/1,5; sem entalhe = 1). Ao final verifica o escoamento na primeira volta (von Mises máximo) e sugere o diâmetro comercial. Propriedades dos aços são valores típicos de referência — use as do certificado do material.",
  fields: [
    { id: "mat", label: "Material", type: "select", options: Object.entries(MATERIAIS_EIXO).map(([value, m]) => ({ value, label: `${m.label} (Sut ${m.Sut} / Sy ${m.Sy} MPa)` })) },
    { id: "acab", label: "Acabamento superficial", type: "select", options: Object.entries(ACABAMENTOS).map(([value, a]) => ({ value, label: a.label })) },
    { id: "conf", label: "Confiabilidade", type: "select", options: [
      { value: "99", label: "99 % (ke = 0,814)" }, { value: "90", label: "90 % (ke = 0,897)" }, { value: "95", label: "95 % (ke = 0,868)" },
      { value: "99.9", label: "99,9 % (ke = 0,753)" }, { value: "50", label: "50 % (ke = 1,000)" },
    ] },
    { id: "M", label: "M — momento fletor no ponto crítico", ph: "150", hint: "N·m", units: U_TORQUE },
    { id: "T", label: "T — torque transmitido", ph: "200", hint: "N·m", units: U_TORQUE },
    { id: "Kf", label: "Kf — concentração de tensão (flexão)", ph: "1.7", hint: "—" },
    { id: "Kfs", label: "Kfs — concentração de tensão (torção)", ph: "1.5", hint: "—" },
    { id: "n", label: "n — fator de segurança", ph: "2", hint: "—" },
  ],
  example: { mat: "1045", acab: "usinado", conf: "99", M: 150, T: 200, Kf: 1.7, Kfs: 1.5, n: 2 },
  calc(v) {
    if (v.M < 0 || v.T < 0) throw new Error("Informe M e T em módulo (≥ 0)");
    if (!(v.M > 0 || v.T > 0)) throw new Error("Informe ao menos M ou T maior que zero");
    if (!(v.Kf >= 1) || !(v.Kfs >= 1)) throw new Error("Kf e Kfs devem ser ≥ 1");
    if (!(v.n >= 1)) throw new Error("Fator de segurança n deve ser ≥ 1");
    const m = MATERIAIS_EIXO[v.mat], ac = ACABAMENTOS[v.acab], ke = CONFIABILIDADE[v.conf];
    if (!m || !ac || ke === undefined) throw new Error("Opção inválida de material/acabamento/confiabilidade");
    const ka = ac.a * Math.pow(m.Sut, ac.b);
    const M = v.M * 1000, T = v.T * 1000; // N·mm
    const p = { M, T, Sut: m.Sut, Sy: m.Sy, ka, ke, Kf: v.Kf, Kfs: v.Kfs, n: v.n };
    const r = diametroEixo(p);
    if (r.d > 250) throw new Error(`d = ${fx(r.d, 1)} mm fora da faixa do fator kb (≤ 254 mm) — revise cargas/material`);
    const dCom = DIAM_EIXO.find((x) => x >= r.d - 1e-9) ?? Math.ceil(r.d);
    const ver = verificaEixo({ ...p, d: dCom });
    const escOk = ver.nEsc >= 1;
    return {
      val: [
        `── MATERIAL ─────────────────────────`,
        `${m.label}: Sut = ${m.Sut} MPa   Sy = ${m.Sy} MPa`,
        `── LIMITE DE FADIGA (Marin) ─────────`,
        `Se' = 0,5·Sut = ${fx(r.SeLinha, 1)} MPa`,
        `ka = ${ac.a}·Sut^${ac.b} = ${fx(ka, 3)}  (${ac.label.toLowerCase()})`,
        `kb = ${fx(r.kb, 3)}  (iterado com d)   kc = 1   kd = 1   ke = ${fx(ke, 3)}`,
        `Se = ka·kb·kc·kd·ke·Se' = ${fx(r.Se, 1)} MPa`,
        `── DIÂMETRO (DE-ASME elíptico) ──────`,
        `M = ${fx(v.M)} N·m (alternado)   T = ${fx(v.T)} N·m (constante)`,
        `Kf = ${v.Kf}   Kfs = ${v.Kfs}   n = ${v.n}`,
        `d mínimo = ${fx(r.d, 2)} mm`,
        `→ diâmetro comercial sugerido: ${dCom} mm`,
        `── VERIFICAÇÃO COM d = ${dCom} mm ────────`,
        `σa = 32Kf·M/πd³ = ${fx(ver.sigma, 1)} MPa   τm = 16Kfs·T/πd³ = ${fx(ver.tau, 1)} MPa`,
        `n fadiga = ${fx(ver.nFad, 2)} ${ver.nFad >= v.n ? "✓ ≥ n" : "✗ < n"}`,
        `σ' von Mises = ${fx(ver.vm, 1)} MPa → n escoamento = Sy/σ' = ${fx(ver.nEsc, 2)} ${escOk ? "✓" : "✗ ESCOAMENTO — aumentar d ou trocar material"}`,
        `⚠ propriedades típicas do aço; confirme no certificado do material`,
      ].join("\n"),
      unit: "", multi: true,
    };
  },
  result: "eixo",
};

/* ═══════════ M2 — Parafusos (ISO 898-1 / ISO 261) ═══════════ */

/** Rosca métrica grossa — passo (ISO 261) e área resistente à tração At (ISO 898-1), mm / mm². */
export const ROSCAS = {
  M6: { d: 6, p: 1.0, At: 20.1 }, M8: { d: 8, p: 1.25, At: 36.6 }, M10: { d: 10, p: 1.5, At: 58.0 },
  M12: { d: 12, p: 1.75, At: 84.3 }, M14: { d: 14, p: 2.0, At: 115 }, M16: { d: 16, p: 2.0, At: 157 },
  M18: { d: 18, p: 2.5, At: 192 }, M20: { d: 20, p: 2.5, At: 245 }, M22: { d: 22, p: 2.5, At: 303 },
  M24: { d: 24, p: 3.0, At: 353 }, M27: { d: 27, p: 3.0, At: 459 }, M30: { d: 30, p: 3.5, At: 561 },
};

/** Classes de resistência — tensão de prova Sp, Sut, Sy (MPa), ISO 898-1 (8.8 muda em d = 16 mm). */
export function propriedadesClasse(classe, d) {
  if (classe === "8.8") return d <= 16 ? { Sp: 580, Sut: 800, Sy: 640 } : { Sp: 600, Sut: 830, Sy: 660 };
  if (classe === "10.9") return { Sp: 830, Sut: 1040, Sy: 940 };
  if (classe === "12.9") return { Sp: 970, Sut: 1220, Sy: 1100 };
  throw new Error("Classe de resistência inválida");
}

const parafuso = {
  id: "parafuso",
  icon: "screw",
  name: "Parafusos — Pré-carga e Torque de Aperto",
  desc: "rosca métrica M6–M30, classes 8.8/10.9/12.9",
  norma: "ISO 898-1 · ISO 261",
  formula: "Fp = At·Sp (carga de prova) | Fi = 0,75·Fp (reutilizável) ou 0,90·Fp (permanente) | T = K·Fi·d | σi = Fi/At",
  context:
    "Calcula a força de pré-carga recomendada e o torque de aperto de um parafuso de rosca métrica grossa. A área resistente à tração At e o passo vêm da ISO 898-1/ISO 261; a tensão de prova Sp depende da classe de resistência (na 8.8 muda acima de M16). A pré-carga recomendada é 75% da carga de prova para uniões que serão desmontadas e 90% para uniões permanentes (Shigley, eq. 8-31). O torque usa o coeficiente de torque K, que depende do acabamento e da lubrificação (Shigley Tab. 8-15) — é a maior fonte de incerteza: confirme com o fabricante do fixador ou use torquímetro com ângulo.",
  fields: [
    { id: "rosca", label: "Rosca (métrica grossa)", type: "select", options: Object.entries(ROSCAS).map(([value, r]) => ({ value, label: `${value} × ${String(r.p).replace(".", ",")} (At ${String(r.At).replace(".", ",")} mm²)` })) },
    { id: "classe", label: "Classe de resistência", type: "select", options: [
      { value: "8.8", label: "8.8" }, { value: "10.9", label: "10.9" }, { value: "12.9", label: "12.9" },
    ] },
    { id: "uniao", label: "Tipo de união", type: "select", options: [
      { value: "0.75", label: "Reutilizável — Fi = 0,75·Fp" }, { value: "0.90", label: "Permanente — Fi = 0,90·Fp" },
    ] },
    { id: "K", label: "Coeficiente de torque K", type: "select", options: [
      { value: "0.20", label: "0,20 — zincado / genérico" }, { value: "0.30", label: "0,30 — oxidado preto, seco" },
      { value: "0.18", label: "0,18 — lubrificado" }, { value: "0.16", label: "0,16 — cadmiado" },
    ] },
    { id: "P", label: "carga externa de tração por parafuso (opcional)", ph: "", hint: "kN", optional: true, units: [{ value: "kN", factor: 1 }, { value: "kgf", factor: 0.00980665 }] },
  ],
  example: { rosca: "M10", classe: "8.8", uniao: "0.75", K: "0.20" },
  calc(v) {
    const r = ROSCAS[v.rosca];
    if (!r) throw new Error("Rosca inválida");
    const prop = propriedadesClasse(v.classe, r.d);
    const fr = Number(v.uniao), K = Number(v.K);
    const Fp = r.At * prop.Sp;      // N
    const Fi = fr * Fp;             // N
    const T = (K * Fi * r.d) / 1000; // N·m
    const sigI = Fi / r.At;
    const lines = [
      `── ROSCA ────────────────────────────`,
      `${v.rosca} × ${r.p} — At = ${r.At} mm²   d = ${r.d} mm`,
      `Classe ${v.classe}: Sp = ${prop.Sp} MPa   Sy = ${prop.Sy} MPa   Sut = ${prop.Sut} MPa`,
      `── PRÉ-CARGA ────────────────────────`,
      `Fp = At·Sp = ${fx(Fp / 1000, 2)} kN`,
      `Fi = ${fx(fr, 2)}·Fp = ${fx(Fi / 1000, 2)} kN   (σi = ${fx(sigI, 0)} MPa)`,
      `── TORQUE DE APERTO ─────────────────`,
      `T = K·Fi·d = ${K}·${fx(Fi / 1000, 2)} kN·${r.d} mm = ${fx(T, 1)} N·m  (${fx(T / 9.80665, 2)} kgf·m)`,
    ];
    if (v.P > 0) {
      const P = v.P * 1000;
      const sep = P >= Fi;
      lines.push(
        `── CARGA EXTERNA (simplificado) ─────`,
        `P = ${fx(v.P, 2)} kN por parafuso`,
        sep ? `✗ P ≥ Fi — a junta pode SEPARAR: aumente a classe/diâmetro ou o nº de parafusos` : `✓ P < Fi — junta não separa (margem ${fx(Fi / P, 2)}×)`,
        `⚠ verificação completa da junta exige as rigidezes do parafuso e das peças (fator C)`,
      );
    }
    lines.push(`⚠ K é estimativa — confirme com o fabricante do fixador`);
    return { val: lines.join("\n"), unit: "", multi: true };
  },
  result: "parafuso",
};

/* ═══════════ M3 — Engrenagens cilíndricas de dentes retos ═══════════ */

/** Módulos normalizados ISO 54 (mm). */
const MODULOS_I = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50];
const MODULOS_II = [1.125, 1.375, 1.75, 2.25, 2.75, 3.5, 4.5, 5.5, 7, 9, 11, 14, 18, 22, 28, 36, 45];

/** Zmín sem interferência (pinhão × cremalheira, adendo = m): 2/sen²α. */
export const zMinTeorico = (alphaDeg) => 2 / Math.sin((alphaDeg * Math.PI) / 180) ** 2;

export function geometriaEngrenagem(m, Z1, Z2, alphaDeg) {
  const a = (alphaDeg * Math.PI) / 180;
  const d1 = m * Z1, d2 = m * Z2;
  return {
    d1, d2, da1: d1 + 2 * m, da2: d2 + 2 * m, df1: d1 - 2.5 * m, df2: d2 - 2.5 * m,
    db1: d1 * Math.cos(a), db2: d2 * Math.cos(a), dist: (m * (Z1 + Z2)) / 2, i: Z2 / Z1, p: Math.PI * m, h: 2.25 * m,
  };
}

const engrenagem = {
  id: "engrenagem",
  icon: "circle",
  name: "Engrenagens Cilíndricas de Dentes Retos — Geometria",
  desc: "diâmetros, distância entre centros, relação e interferência",
  norma: "ISO 54 · DIN 867",
  formula:
    "d = m·Z | da = d + 2m | df = d − 2,5m | db = d·cos α | a = m·(Z1 + Z2)/2 | i = Z2/Z1 | p = π·m | Zmín = 2/sen²α",
  context:
    "Geometria de um par de engrenagens cilíndricas de dentes retos com perfil de referência DIN 867 (adendo = m, dedendo = 1,25m, ângulo de pressão α). Calcula os diâmetros primitivo, de cabeça, de pé e de base, a distância entre centros, a relação de transmissão e o passo. Verifica o módulo contra as séries normalizadas da ISO 54 e o número mínimo de dentes do pinhão para não haver interferência (rebaixo no pé do dente): Zmín = 2/sen²α ≈ 17 para α = 20°. Na prática admite-se até ~14 dentes com pequeno rebaixo ou com correção de perfil. Informando a rotação do pinhão, calcula a rotação da coroa.",
  fields: [
    { id: "m", label: "m — módulo", ph: "2", hint: "mm" },
    { id: "Z1", label: "Z1 — dentes do pinhão (motor)", ph: "20", hint: "dentes" },
    { id: "Z2", label: "Z2 — dentes da coroa (movida)", ph: "40", hint: "dentes" },
    { id: "alpha", label: "Ângulo de pressão α", type: "select", options: [
      { value: "20", label: "20° (padrão)" }, { value: "14.5", label: "14,5°" }, { value: "25", label: "25°" },
    ] },
    { id: "n1", label: "rotação do pinhão n1 (opcional)", ph: "1750", hint: "rpm", optional: true },
  ],
  example: { m: 2, Z1: 20, Z2: 40, alpha: "20", n1: 1750 },
  calc(v) {
    pos(v.m, "Módulo m");
    if (!Number.isInteger(v.Z1) || !Number.isInteger(v.Z2) || v.Z1 < 6 || v.Z2 < 6) throw new Error("Z1 e Z2 devem ser inteiros ≥ 6");
    const alpha = Number(v.alpha);
    const g = geometriaEngrenagem(v.m, v.Z1, v.Z2, alpha);
    const zt = zMinTeorico(alpha);
    const zMin = Math.ceil(zt - 0.15); // 20° → 17,1 ≈ 17 (valor usual); 14,5° → 32; 25° → 12
    const serie = MODULOS_I.includes(v.m) ? "série I" : MODULOS_II.includes(v.m) ? "série II" : null;
    const lines = [
      `── DADOS ────────────────────────────`,
      `m = ${v.m} mm   α = ${String(alpha).replace(".", ",")}°   Z1 = ${v.Z1}   Z2 = ${v.Z2}`,
      serie ? `✓ módulo normalizado (ISO 54, ${serie})` : `⚠ módulo fora das séries ISO 54 — prefira 1; 1,25; 1,5; 2; 2,5; 3; 4; 5; 6; 8…`,
      `── DIÂMETROS (mm) ───────────────────`,
      `primitivo:  d1 = ${fx(g.d1)}   d2 = ${fx(g.d2)}`,
      `de cabeça:  da1 = ${fx(g.da1)}   da2 = ${fx(g.da2)}`,
      `de pé:      df1 = ${fx(g.df1)}   df2 = ${fx(g.df2)}`,
      `de base:    db1 = ${fx(g.db1)}   db2 = ${fx(g.db2)}`,
      `── PAR ──────────────────────────────`,
      `distância entre centros a = ${fx(g.dist)} mm`,
      `relação i = Z2/Z1 = ${fx(g.i, 3)}`,
      `passo p = π·m = ${fx(g.p, 3)} mm   altura do dente h = 2,25m = ${fx(g.h)} mm`,
    ];
    if (v.n1 > 0) lines.push(`n2 = n1/i = ${fx(v.n1 / g.i, 1)} rpm`);
    lines.push(
      `── INTERFERÊNCIA ────────────────────`,
      `Zmín = 2/sen²α = ${fx(zt, 2)} → ${zMin} dentes`,
      v.Z1 >= zMin ? `✓ Z1 = ${v.Z1} ≥ ${zMin} — sem interferência` : `⚠ Z1 = ${v.Z1} < ${zMin} — haverá rebaixo: aumente Z1 ou use correção de perfil (x > 0)`,
    );
    return { val: lines.join("\n"), unit: "", multi: true };
  },
  result: "engrenagem",
};

/* ═══════════ Cálculos originais (migrados de data.ts) ═══════════ */

const DIAGRAMA_RPM = `
    <svg viewBox="0 0 300 132" class="dg" role="img" aria-label="Ferramenta de corte em rotação">
      <line class="dg-cl" x1="150" y1="14" x2="150" y2="120"/>
      <circle class="dg-line" cx="150" cy="66" r="40"/>
      <circle class="dg-fill" cx="150" cy="66" r="3"/>
      <line class="dg-dim" x1="110" y1="66" x2="190" y2="66"/>
      <path class="dg-dim" d="M110 61 L110 71 M190 61 L190 71"/>
      <text class="dg-t" x="146" y="60" text-anchor="end">D</text>
      <path class="dg-line" d="M150 26 A 40 40 0 0 1 190 66" fill="none"/>
      <path class="dg-line" d="M184 60 L190 66 L184 72" fill="none"/>
      <text class="dg-t" x="214" y="52">n (rpm)</text>
      <line class="dg-acc" x1="150" y1="26" x2="228" y2="26"/>
      <path class="dg-acc" d="M222 22 L228 26 L222 30" fill="none"/>
      <text class="dg-t-acc" x="186" y="20">Vc</text>
    </svg>`;

const FRACS = [
  [1,64],[1,32],[3,64],[1,16],[5,64],[3,32],[7,64],[1,8],
  [9,64],[5,32],[11,64],[3,16],[13,64],[7,32],[15,64],[1,4],
  [17,64],[9,32],[19,64],[5,16],[21,64],[11,32],[23,64],[3,8],
  [25,64],[13,32],[27,64],[7,16],[29,64],[15,32],[31,64],[1,2],
  [33,64],[17,32],[35,64],[9,16],[37,64],[19,32],[39,64],[5,8],
  [41,64],[21,32],[43,64],[11,16],[45,64],[23,32],[47,64],[3,4],
  [49,64],[25,32],[51,64],[13,16],[53,64],[27,32],[55,64],[7,8],
  [57,64],[29,32],[59,64],[15,16],[61,64],[31,32],[63,64],[1,1],
];

const originais = [
  {
    id: "rpm",
    icon: "rotate",
    name: "Cálculo de RPM",
    desc: "velocidade de corte × diâmetro",
    formula: "RPM = (1000 × Vc) / (π × D)",
    context: "Determina a rotação ideal de uma ferramenta de corte (fresa, broca, torno) a partir da velocidade de corte recomendada pelo fabricante e o diâmetro da ferramenta. Essencial para programação CNC e setup de máquinas-ferramenta.",
    diagram: DIAGRAMA_RPM,
    fields: [
      { id: "vc", label: "Vc — velocidade de corte", ph: "80", hint: "m/min", units: [{ value: "m/min", factor: 1 }, { value: "m/s", factor: 60 }] },
      { id: "d",  label: "D — diâmetro da ferramenta", ph: "50", hint: "mm", units: U_MM },
    ],
    example: { vc: 80, d: 50 },
    calc(v) {
      if (v.d <= 0) throw new Error("Diâmetro deve ser maior que zero");
      return { val: ((1000 * v.vc) / (Math.PI * v.d)).toFixed(1), unit: "rpm" };
    },
    result: "RPM",
  },
  {
    id: "conv",
    icon: "arrow",
    name: "Conversão mm → pol",
    desc: "milímetros para polegadas e fração",
    formula: "1 in = 25,4 mm",
    context: "Converte medidas métricas para o sistema imperial, com representação em fração decimal usada em ferramentas e peças importadas. Útil em manutenção industrial e projetos com componentes americanos.",
    fields: [{ id: "mm", label: "valor em milímetros", ph: "25.4", hint: "mm" }],
    example: { mm: 12.7 },
    calc(v) {
      const inches = v.mm / 25.4;
      if (v.mm < 0) throw new Error("Informe um valor ≥ 0");
      let whole = Math.floor(inches);
      const frac  = inches - whole;
      let bestFrac = [0, 64], bestDiff = frac;
      for (const [n, d] of FRACS) {
        const diff = Math.abs(n / d - frac);
        if (diff < bestDiff) { bestDiff = diff; bestFrac = [n, d]; }
      }
      // fração arredondada para 1/1 → soma 1 à parte inteira
      if (bestFrac[0] === bestFrac[1]) { whole += 1; bestFrac = [0, 64]; }
      const fracPart = bestFrac[0] === 0 ? "" : `${bestFrac[0]}/${bestFrac[1]}`;
      const fracStr = frac < 0.001 ? "" : ` (≈ ${[whole > 0 || !fracPart ? whole : "", fracPart].filter(Boolean).join(" ")}")`;
      return { val: inches.toFixed(4) + " in" + fracStr, unit: "" };
    },
    result: "polegadas",
  },
  {
    id: "polia",
    icon: "circle",
    name: "Relação de polias",
    desc: "N2 pela relação de diâmetros",
    formula: "N2 = (D1 × N1) / D2",
    context: "Calcula a rotação de saída de um sistema de transmissão por polias e correias. Usado para adequar a velocidade de motores a máquinas como compressores, bombas e ventiladores.",
    fields: [
      { id: "d1", label: "D1 — diâmetro da polia motriz", ph: "100", hint: "mm", units: U_MM },
      { id: "n1", label: "N1 — rotação do motor", ph: "1200", hint: "rpm" },
      { id: "d2", label: "D2 — diâmetro da polia movida", ph: "200", hint: "mm", units: U_MM },
    ],
    example: { d1: 100, n1: 1750, d2: 250 },
    calc(v) {
      if (v.d2 <= 0) throw new Error("D2 deve ser > 0");
      return { val: ((v.d1 * v.n1) / v.d2).toFixed(1), unit: "rpm" };
    },
    result: "N2",
  },
  {
    id: "avanco",
    icon: "screw",
    name: "Avanço de roscas",
    desc: "passo × número de entradas",
    formula: "Avanço = Passo × Nº entradas",
    context: "Determina o avanço axial por volta em sistemas de parafuso/porca. Fundamental em projetos de fixação, roscas de movimento (trapezoidais, acme) e programação de tornos CNC.",
    fields: [
      { id: "p", label: "passo", ph: "1.5", hint: "mm" },
      { id: "e", label: "nº de entradas", ph: "2", hint: "entradas" },
    ],
    example: { p: 4, e: 2 },
    calc(v) {
      return { val: (v.p * v.e).toFixed(3), unit: "mm/volta" };
    },
    result: "avanço",
  },
  {
    id: "cone",
    icon: "triangle",
    name: "Ângulo de cones",
    desc: "torneamento cônico — ângulo de inclinação",
    formula: "α = arctan((D1 − D2) / (2 × L))",
    context: "Calcula o ângulo de inclinação para torneamento de peças cônicas. Usado para regulagem do carro superior do torno ou para programação de interpolação linear em CNC.",
    fields: [
      { id: "d1c", label: "D1 — diâmetro maior", ph: "60", hint: "mm", units: U_MM },
      { id: "d2c", label: "D2 — diâmetro menor", ph: "40", hint: "mm", units: U_MM },
      { id: "lc",  label: "L — comprimento do cone", ph: "100", hint: "mm", units: U_MM },
    ],
    example: { d1c: 60, d2c: 40, lc: 100 },
    calc(v) {
      if (v.lc <= 0) throw new Error("Comprimento L deve ser > 0");
      return {
        val: (Math.atan((v.d1c - v.d2c) / (2 * v.lc)) * (180 / Math.PI)).toFixed(4),
        unit: "°",
      };
    },
    result: "ângulo α",
  },
  {
    id: "tensao",
    icon: "sigma",
    name: "Tensão normal",
    desc: "tensão de tração ou compressão na seção",
    formula: "σ = F / A",
    context: "Calcula a tensão normal em elementos estruturais submetidos a tração ou compressão. Compare o resultado com o limite de escoamento do material (ex: aço SAE 1045: ~310 MPa) para verificar segurança.",
    fields: [
      { id: "f", label: "força F aplicada", ph: "5000", hint: "N", units: U_FORCA_N },
      { id: "a", label: "área A da seção transversal", ph: "100", hint: "mm²", units: [{ value: "mm²", factor: 1 }, { value: "cm²", factor: 100 }] },
    ],
    example: { f: 5000, a: 100 },
    calc(v) {
      if (v.a <= 0) throw new Error("Área deve ser > 0");
      return { val: (v.f / v.a).toFixed(3), unit: "MPa" };
    },
    result: "σ (tensão)",
  },
  {
    id: "potencia",
    icon: "bolt",
    name: "Potência mecânica",
    desc: "potência de eixo por torque e rotação",
    formula: "P = T × ω  |  ω = 2π × n / 60  |  1 cv = 735,5 W",
    context: "Calcula a potência mecânica transmitida por um eixo em rotação. Use para dimensionar motores, redutores e verificar se a transmissão suporta a carga aplicada.",
    fields: [
      { id: "t", label: "torque T no eixo", ph: "50", hint: "N·m", units: U_TORQUE },
      { id: "n", label: "rotação n", ph: "1450", hint: "rpm" },
    ],
    example: { t: 50, n: 1450 },
    calc(v) {
      const P = v.t * 2 * Math.PI * v.n / 60;
      return { val: `${P.toFixed(2)} W  =  ${(P / 1000).toFixed(3)} kW  =  ${(P / 735.5).toFixed(2)} cv`, unit: "" };
    },
    result: "potência P",
  },
  {
    id: "dilatacao",
    icon: "temp",
    name: "Dilatação térmica linear",
    desc: "variação de comprimento por temperatura",
    formula: "ΔL = α × L₀ × ΔT",
    context: "Calcula quanto uma peça se dilata com a variação de temperatura. Indispensável em projetos de trilhos, tubulações, eixos e montagens com ajuste de interferência.",
    fields: [
      { id: "al", label: "coef. de dilatação α (×10⁻⁶)", ph: "12", hint: "/°C" },
      { id: "l0", label: "comprimento inicial L₀", ph: "1000", hint: "mm", units: [{ value: "mm", factor: 1 }, { value: "m", factor: 1000 }, { value: "in", factor: 25.4 }] },
      { id: "dt", label: "variação de temperatura ΔT", ph: "80", hint: "°C" },
    ],
    example: { al: 12, l0: 1000, dt: 80 },
    calc(v) {
      return { val: ((v.al * 1e-6) * v.l0 * v.dt).toFixed(4), unit: "mm" };
    },
    result: "ΔL",
  },
];

export const MECANICA = {
  label: "Mecânica",
  icon: "tool",
  calcs: [...originais, eixo, parafuso, engrenagem],
};
