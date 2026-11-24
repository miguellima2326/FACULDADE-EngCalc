/**
 * EngCalc — ELÉTRICA
 * Cabos MT/BT (capacidade de condução + queda de tensão) e seção mínima por curto-circuito.
 * Fatores de correção: lib/nbr5410.ts (tabelas com a origem comentada).
 */
import {
  fatorInstalacao, LABEL_ISOLACAO, LABEL_ESPACAMENTO, type FatorResult,
  izTabela, resistenciaCondutor, SECOES_IZ, SECAO_MIN_AL, TEMP_OPERACAO, X_CABO_OHM_KM, K_ADIABATICO,
  type Material, type Isolacao, type Metodo,
} from "./lib/nbr5410.js";

const INSTALACAO_OPCOES = [
  { value: "enterrado_direto", label: "Enterrado direto no solo" },
  { value: "enterrado_duto",   label: "Enterrado em eletroduto" },
  { value: "ao_ar",            label: "Ao ar livre (bandeja/leito/eletroduto aparente)" },
];
const ISOLACAO_OPCOES = [
  { value: "xlpe", label: "EPR / HEPR / XLPE (90 °C)" },
  { value: "pvc",  label: "PVC (70 °C)" },
];
const ESPACAMENTO_OPCOES = [
  { value: "encostados", label: "Encostados (sem espaçamento)" },
  { value: "1_diametro", label: "1 diâmetro de cabo (só direto)" },
  { value: "0.125",      label: "0,125 m (só direto)" },
  { value: "0.25",       label: "0,25 m" },
  { value: "0.5",        label: "0,5 m" },
  { value: "1.0",        label: "1,0 m (só eletroduto)" },
];
const ENTERRADO = { id: "instalacao", in: ["enterrado_direto", "enterrado_duto"] };

const labelInstalacao = (code: string) => INSTALACAO_OPCOES.find((o) => o.value === code)?.label ?? code;

const SERIE_COMERCIAL = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300, 400, 500, 630];

/** In trifásica: In = 1000·S(kVA) / (√3·V) */
export const correnteNominal = (S_kVA: number, V: number) => (1000 * S_kVA) / (Math.sqrt(3) * V);
/** ΔV% = K·L·I / (10·V) — K em V/(A·km), L em m, I em A, V em V */
export const quedaTensaoPct = (K: number, L: number, I: number, V: number) => (K * L * I) / (10 * V);
/** Seção mínima adiabática: S = Icc·√t / k (Icc em A) */
export const secaoCurto = (IccA: number, t: number, k: number) => (IccA * Math.sqrt(t)) / k;
export const secaoComercial = (S: number) => SERIE_COMERCIAL.find((s) => s >= S) ?? null;

function camposComuns(nivel: "MT" | "BT") {
  return [
    { id: "S",          label: "S — potência aparente",              ph: "2000", hint: "kVA" },
    { id: "V",          label: "V — tensão de linha",                ph: nivel === "MT" ? "4160" : "460", hint: "V" },
    { id: "isolacao",   label: "Isolação do cabo",                   type: "select", options: ISOLACAO_OPCOES },
    { id: "instalacao", label: "Método de instalação",               type: "select", options: INSTALACAO_OPCOES },
    { id: "tempSolo",   label: "T — temperatura do solo/ambiente",   ph: nivel === "MT" ? "30" : "35", hint: "°C" },
    { id: "resSolo",    label: "ρ — resistividade térmica do solo",  ph: "1.5", hint: "K·m/W", dependsOn: ENTERRADO },
    { id: "profundidade", label: "h — profundidade de instalação",   ph: "0.7", hint: "m",     dependsOn: ENTERRADO },
    { id: "espacamento", label: "Espaçamento entre circuitos enterrados", type: "select", options: ESPACAMENTO_OPCOES, dependsOn: ENTERRADO },
  ];
}

function validaBase(v: any) {
  if (!(v.S > 0)) throw new Error("Potência S deve ser > 0");
  if (!(v.V > 0)) throw new Error("Tensão V deve ser > 0");
  if (v.L < 0) throw new Error("Distância L deve ser ≥ 0");
  if (v.K < 0) throw new Error("K deve ser ≥ 0");
  if (!(v.dVadm > 0)) throw new Error("ΔV admissível deve ser > 0");
  const temSesc = v.Sesc !== undefined && v.Sesc !== null;
  const temIz = v.Iz !== undefined && v.Iz !== null;
  if (temSesc && !(v.Sesc > 0)) throw new Error("Seção do cabo candidato deve ser > 0");
  if (temIz && !(v.Iz > 0)) throw new Error("Iz do cabo candidato deve ser > 0");
  if (temSesc && !temIz) throw new Error("Informe também o Iz do cabo candidato (ou deixe os dois em branco)");
  if (temIz && !temSesc) throw new Error("Informe também a seção do cabo candidato (ou deixe os dois em branco)");
  return temSesc && temIz;
}

function linhasInstalacao(v: any, fc: FatorResult) {
  const enterrado = v.instalacao !== "ao_ar";
  return [
    `── CONDIÇÕES DE INSTALAÇÃO ───────────`,
    `Método:             ${labelInstalacao(v.instalacao)}`,
    `Isolação:           ${LABEL_ISOLACAO[v.isolacao as "pvc" | "xlpe"]}`,
    `${enterrado ? "Temp. do solo:     " : "Temp. ambiente:    "} ${v.tempSolo.toFixed(1)} °C → Kt=${fc.Kt.toFixed(2)} (${fc.refs.Kt})`,
    enterrado ? `Resistiv. do solo:  ${v.resSolo.toFixed(2)} K·m/W → Ks=${fc.Ks.toFixed(2)} (${fc.refs.Ks})` : `Resistiv. do solo:  não aplicável (ao ar) → Ks=1.00`,
    enterrado ? `Profundidade:       ${v.profundidade.toFixed(2)} m → Kp=${fc.Kp.toFixed(2)} (${fc.refs.Kp})` : `Profundidade:       não aplicável (ao ar) → Kp=1.00`,
    `Circuitos agrupados:${v.nCircuitos}${enterrado && fc.espacamentoUsado ? ` (${LABEL_ESPACAMENTO[fc.espacamentoUsado]})` : ""} → Kg=${fc.Kg.toFixed(2)} (${fc.refs.Kg})`,
    `Fc = 1/(Kt·Ks·Kp·Kg) = 1/(${fc.Kt.toFixed(2)}·${fc.Ks.toFixed(2)}·${fc.Kp.toFixed(2)}·${fc.Kg.toFixed(2)}) = ${fc.Fc.toFixed(3)}`,
    ...fc.avisos,
  ];
}

const DIAGRAM_MT = `
    <svg viewBox="0 0 300 132" class="dg" role="img" aria-label="Alimentador de média tensão: transformador, cabo e barramento">
      <circle class="dg-line" cx="46" cy="60" r="20"/>
      <circle class="dg-line" cx="64" cy="60" r="20"/>
      <text class="dg-t" x="55" y="98" text-anchor="middle">MT</text>

      <line class="dg-strong" x1="84" y1="60" x2="216" y2="60"/>

      <rect class="dg-line" x="216" y="34" width="14" height="52"/>
      <text class="dg-t" x="223" y="98" text-anchor="middle">carga</text>

      <line class="dg-acc" x1="100" y1="30" x2="200" y2="30"/>
      <path class="dg-acc" d="M194 26 L200 30 L194 34" fill="none"/>
      <text class="dg-t-acc" x="150" y="22" text-anchor="middle">In → Ic</text>

      <line class="dg-dim" x1="84" y1="106" x2="216" y2="106"/>
      <path class="dg-dim" d="M84 101 L84 111 M216 101 L216 111"/>
      <text class="dg-t" x="150" y="124" text-anchor="middle">L (comprimento do trecho)</text>
    </svg>`;

const DIAGRAM_BT = `
    <svg viewBox="0 0 300 134" class="dg" role="img" aria-label="Circuito de baixa tensão com cabos em paralelo por fase">
      <text class="dg-t-acc" x="128" y="14" text-anchor="middle">Np cabos / fase</text>

      <line class="dg-strong" x1="34" y1="24" x2="34" y2="92"/>
      <line class="dg-strong" x1="222" y1="24" x2="222" y2="92"/>

      <line class="dg-line" x1="34" y1="34" x2="222" y2="34"/>
      <line class="dg-line" x1="34" y1="48" x2="222" y2="48"/>
      <line class="dg-line" x1="34" y1="62" x2="222" y2="62"/>
      <line class="dg-cl"   x1="34" y1="76" x2="222" y2="76"/>

      <text class="dg-t" x="34" y="108" text-anchor="middle">QGBT</text>
      <text class="dg-t" x="222" y="108" text-anchor="middle">CCM</text>

      <line class="dg-dim" x1="34" y1="120" x2="222" y2="120"/>
      <path class="dg-dim" d="M34 115 L34 125 M222 115 L222 125"/>
      <text class="dg-t" x="128" y="132" text-anchor="middle">L (comprimento)</text>
    </svg>`;


/* ═══════════════════ Spec 008 — helpers puros (testados) ═══════════════════ */
export const SQRT3 = Math.sqrt(3);
export type Sistema = "tri" | "mono";

/** Corrente de projeto a partir de P (kW), V (V) e fp. */
export const correnteDePotencia = (P_kW: number, V: number, fp: number, sistema: Sistema) =>
  (P_kW * 1000) / ((sistema === "tri" ? SQRT3 : 1) * V * fp);

/** ΔV% = k·Ib·L·(R·cosφ + X·senφ)/V·100, k = √3 (tri) ou 2 (mono); R, X em Ω/km, L em m. */
export function quedaTensaoRX(Ib: number, L: number, R: number, X: number, fp: number, V: number, sistema: Sistema) {
  const k = sistema === "tri" ? SQRT3 : 2;
  const sen = Math.sqrt(Math.max(0, 1 - fp * fp));
  return ((k * Ib * (L / 1000) * (R * fp + X * sen)) / V) * 100;
}

export interface SecaoCaboInput {
  Ib: number; V: number; fp: number; sistema: Sistema; material: Material; isolacao: Isolacao; metodo: Metodo;
  Kcorr: number; L: number; dVadm: number; Icc?: number; t?: number;
}
/** Menor seção que atende capacidade, queda de tensão e curto (cada critério isolado + adotada). */
export function secaoAutomatica(x: SecaoCaboInput) {
  const carregados = x.sistema === "tri" ? 3 : 2;
  const secoes = SECOES_IZ.filter((s) => x.material === "cu" || s >= SECAO_MIN_AL);
  const theta = TEMP_OPERACAO[x.isolacao];
  const linha = (s: number) => {
    const iz = izTabela(x.material, x.isolacao, carregados, x.metodo, s)!;
    const R = resistenciaCondutor(x.material, s, theta)!;
    return { s, iz, izCorr: iz * x.Kcorr, R, dV: quedaTensaoRX(x.Ib, x.L, R, X_CABO_OHM_KM, x.fp, x.V, x.sistema) };
  };
  const tabela = secoes.map(linha);
  const porCapacidade = tabela.find((r) => r.izCorr >= x.Ib) ?? null;
  const porQueda = tabela.find((r) => r.dV <= x.dVadm) ?? null;
  const k = K_ADIABATICO[x.material][x.isolacao];
  const sMinCurto = x.Icc && x.Icc > 0 ? secaoCurto(x.Icc * 1000, x.t ?? 0.5, k) : 0;
  const porCurto = sMinCurto > 0 ? tabela.find((r) => r.s >= sMinCurto) ?? null : tabela[0]!;
  const cand = [porCapacidade, porQueda, porCurto];
  const adotada = cand.every(Boolean) ? tabela.find((r) => r.s >= Math.max(...cand.map((c) => c!.s)))! : null;
  let determinante = "";
  if (adotada) {
    const nomes: Array<[string, number]> = [["Capacidade de condução", porCapacidade!.s], ["Queda de tensão", porQueda!.s], ["Curto-circuito", sMinCurto > 0 ? porCurto!.s : 0]];
    determinante = nomes.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  return { carregados, theta, k, sMinCurto, porCapacidade, porQueda, porCurto: sMinCurto > 0 ? porCurto : null, adotada, determinante };
}

/** Impedância do transformador (Ω, referida ao secundário) — Z = (Z%/100)·V²/S. */
export function impedanciaTrafo(S_kVA: number, V: number, Zpct: number, XR: number) {
  const Z = (Zpct / 100) * (V * V) / (S_kVA * 1000);
  const R = Z / Math.sqrt(1 + XR * XR);
  return { Z, R, X: R * XR };
}
/** Icc trifásica simétrica (A) para impedância R + jX por fase: Icc = V/(√3·|Z|) (c = 1, rede a montante infinita). */
export const iccTrifasica = (V: number, R: number, X: number) => V / (SQRT3 * Math.hypot(R, X));

export const DISJUNTORES_IN = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63, 70, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600];
export function escolherDisjuntor(Ib: number, Iz: number, fatorI2: number) {
  const In = DISJUNTORES_IN.find((i) => i >= Ib) ?? null;
  if (In === null) return { In: null, I2: 0, ok1: false, ok2: false };
  const I2 = fatorI2 * In;
  return { In, I2, ok1: Ib <= In && In <= Iz, ok2: I2 <= 1.45 * Iz };
}

export const BANCOS_KVAR = [2.5, 5, 7.5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
/** Qc = P·(tan φ1 − tan φ2) (kvar). */
export const potenciaCapacitor = (P_kW: number, fp1: number, fp2: number) => P_kW * (Math.tan(Math.acos(fp1)) - Math.tan(Math.acos(fp2)));
export const fpResultante = (P_kW: number, fp1: number, Qc: number) => {
  const Q = P_kW * Math.tan(Math.acos(fp1)) - Qc;
  return P_kW / Math.hypot(P_kW, Q) * (Q < 0 ? -1 : 1);
};

/** Corrente nominal de motor: In = P/(k·V·η·cosφ), k = √3 (tri) ou 1 (mono). P em W. */
export const correnteMotor = (P_W: number, V: number, eta: number, fp: number, sistema: Sistema) =>
  P_W / ((sistema === "tri" ? SQRT3 : 1) * V * eta * fp);
export const CV_W = 735.5;

const K_OPCOES = [
  { value: "cu_pvc",  label: "Cobre + PVC (k = 115)",        k: 115 },
  { value: "cu_xlpe", label: "Cobre + EPR/XLPE (k = 143)",   k: 143 },
  { value: "al_pvc",  label: "Alumínio + PVC (k = 76)",      k: 76 },
  { value: "al_xlpe", label: "Alumínio + EPR/XLPE (k = 94)", k: 94 },
  { value: "outro",   label: "Outro (informar k)",           k: 0 },
];

export const ELETRICA = {
  label: "Elétrica",
  icon: "transformer",
  calcs: [

    /* ─────────────────────────────────────────────────────────────
       1. CABO DE MÉDIA TENSÃO — In, Ic, ΔV% e verificação do cabo
    ───────────────────────────────────────────────────────────── */
    {
      id: "cabo_mt",
      icon: "transformer",
      name: "Cabo de Média Tensão — Corrente e Queda de Tensão",
      desc: "In, Ic, ΔV% e verificação do cabo (seção + Iz do fabricante)",
      norma: "NBR 14039",
      formula: "In = 1000·S / (√3·V) | Fc = 1/(Kt·Ks·Kp·Kg) | Ic = In·Fc | ΔV% = K·L·In / (10·V) | critério: Iz ≥ Ic e ΔV% ≤ ΔVadm",
      context: "Dimensionamento de cabo alimentador de média tensão (ex.: transformador → cubículo/barramento), trifásico, um cabo por fase. Calcula a corrente nominal In a partir da potência aparente e da tensão de linha, a corrente corrigida Ic e a queda de tensão ΔV% do trecho usando o K (V/A·km) da tabela do fabricante. O fator de correção Fc é calculado a partir das condições reais de lançamento: temperatura (NBR 5410 Tab. 40, coluna da isolação escolhida — PVC 70 °C ou EPR/XLPE 90 °C; ar ref. 30 °C, solo ref. 20 °C), resistividade térmica do solo (Tab. 41, ref. 2,5 K·m/W, linhas diferentes para cabo direto no solo e em eletroduto), profundidade (IEC 60502-2, ref. 0,8 m) e agrupamento (Tab. 42 ao ar; Tab. 44/45 enterrado, conforme o espaçamento entre circuitos). Para MT, esses fatores da NBR 5410 / IEC 60502-2 são usados como aproximação da NBR 14039 — confirme na norma e no catálogo do fabricante. Em seguida verifica um cabo candidato (seção e Iz do catálogo, opcionais) quanto à capacidade de condução e à queda de tensão e aponta o fator determinante.",
      fields: [
        ...camposComuns("MT"),
        { id: "nCircuitos", label: "n — circuitos agrupados",               ph: "2",    hint: "circuitos" },
        { id: "L",     label: "L — comprimento do trecho",                   ph: "115",  hint: "m" },
        { id: "K",     label: "K — queda de tensão do cabo (fabr.)",         ph: "0.15", hint: "V/A·km" },
        { id: "dVadm", label: "ΔV adm. — queda de tensão admissível",        ph: "4",    hint: "%" },
        { id: "Sesc",  label: "seção do cabo candidato (opcional)",          ph: "185",  hint: "mm²", optional: true },
        { id: "Iz",    label: "Iz — capacidade de condução do fabr. (opcional)", ph: "510", hint: "A", optional: true },
      ],
      diagram: DIAGRAM_MT,
      example: { S: 2000, V: 4160, isolacao: "xlpe", instalacao: "enterrado_duto", tempSolo: 30, resSolo: 1.5, profundidade: 0.9, espacamento: "0.25", nCircuitos: 2, L: 115, K: 0.15, dVadm: 4, Sesc: 185, Iz: 510 },
      calc(v: any) {
        const temCabo = validaBase(v);
        const fc = fatorInstalacao({ nivel: "MT", isolacao: v.isolacao, instalacao: v.instalacao, temp: v.tempSolo, resSolo: v.resSolo, profundidade: v.profundidade, nCircuitos: v.nCircuitos, espacamento: v.espacamento });

        const In = correnteNominal(v.S, v.V);
        const Ic = In * fc.Fc;
        const dV = quedaTensaoPct(v.K, v.L, In, v.V);
        const dvOk = dV <= v.dVadm;

        const lines = [
          ...linhasInstalacao(v, fc),
          `── CORRENTES ────────────────────────`,
          `In (nominal):    ${In.toFixed(2)} A   (In = 1000·${v.S} / (√3·${v.V}))`,
          `Ic (corrigida):  ${Ic.toFixed(2)} A   (Ic = In × Fc = ${In.toFixed(2)} × ${fc.Fc.toFixed(3)})`,
          `→ o cabo escolhido precisa ter Iz (tabela do fabricante, condição de referência) ≥ Ic`,
          `── QUEDA DE TENSÃO ──────────────────`,
          `ΔV calculada:    ${dV.toFixed(3)} %   (ΔV% = ${v.K}·${v.L}·${In.toFixed(2)} / (10·${v.V}); admissível ${v.dVadm.toFixed(2)} %)`,
          dvOk ? `✓ ΔV ≤ ΔV admissível` : `✗ ΔV > ΔV admissível — reduza L, aumente a seção ou revise K`,
        ];

        if (temCabo) {
          const ampOk = v.Iz >= Ic;
          const ratioAmp = Ic / v.Iz, ratioDv = dV / v.dVadm;
          const determinante = ratioAmp >= ratioDv ? "Capacidade de Condução" : "Queda de Tensão";
          const margAmp = ((v.Iz - Ic) / Ic) * 100;
          lines.push(
            `── CABO CANDIDATO ${v.Sesc} mm² ─────`,
            `Iz do cabo:      ${v.Iz.toFixed(0)} A`,
            `Ic requerida:    ${Ic.toFixed(2)} A`,
            `Margem:          ${margAmp.toFixed(1)} %   ((Iz − Ic)/Ic)`,
            ampOk ? `✓ Iz ≥ Ic — capacidade de condução OK` : `✗ Iz < Ic — AUMENTAR SEÇÃO DO CABO`,
            `── RESULTADO ────────────────────────`,
            `Fator determinante: ${determinante}`,
            (ampOk && dvOk) ? `✓ Cabo ${v.Sesc} mm² ATENDE aos critérios de MT` : `✗ Cabo ${v.Sesc} mm² NÃO ATENDE — revisar seção/instalação`,
          );
        } else {
          lines.push(
            `── REQUISITOS DO CABO MT ─────────────────`,
            `Iz mínimo necessário: ${Ic.toFixed(2)} A`,
            `→ procure no catálogo um cabo MT ${LABEL_ISOLACAO[v.isolacao as "pvc" | "xlpe"]} para ${v.V} V com Iz ≥ ${Ic.toFixed(2)} A`,
            `⚠ verifique também a seção mínima por curto-circuito (cálculo "Seção Mínima do Cabo por Curto-Circuito")`,
          );
        }
        return { val: lines.join("\n"), unit: "", multi: true };
      },
      result: "cabo MT",
    },

    /* ─────────────────────────────────────────────────────────────
       2. CABO DE BAIXA TENSÃO — Np cabos em paralelo por fase
    ───────────────────────────────────────────────────────────── */
    {
      id: "cabo_bt",
      icon: "cable",
      name: "Cabo de Baixa Tensão — Cabos em Paralelo e Queda de Tensão",
      desc: "In, Ic, corrente por cabo, ΔV% e verificação (Np cabos/fase)",
      norma: "NBR 5410",
      formula: "In = 1000·S / (√3·V) | Fc = 1/(Kt·Ks·Kp·Kg) | Ic/cabo = In·Fc / Np | ΔV% = K·L·(In/Np) / (10·V) | critério: Iz ≥ Ic/cabo e ΔV% ≤ ΔVadm",
      context: "Dimensionamento de circuito de baixa tensão alimentado por Np cabos unipolares em paralelo por fase (comum em ligações transformador→CCM/QGBT de grande corrente). Calcula a corrente nominal In, a corrente corrigida Ic e a corrente exigida por cabo (Ic/Np), além da queda de tensão ΔV% com a corrente dividida entre os cabos em paralelo. O fator de correção Fc vem das tabelas da NBR 5410: temperatura (Tab. 40, coluna da isolação — PVC 70 °C ou EPR/XLPE 90 °C; ar ref. 30 °C, solo ref. 20 °C), resistividade térmica do solo (Tab. 41, ref. 2,5 K·m/W), agrupamento (Tab. 42 ao ar; Tab. 44 diretamente enterrado e Tab. 45 em eletroduto enterrado, conforme o espaçamento). Na NBR 5410 (método D) a profundidade de referência é 0,7 m e não há fator de profundidade. No número de circuitos agrupados inclua os Np conjuntos em paralelo, pois cada conjunto conta como um circuito no agrupamento. Verifica um cabo candidato (seção e Iz unitário, opcionais) e indica o fator determinante.",
      fields: [
        ...camposComuns("BT"),
        { id: "nCircuitos", label: "n — circuitos/cabos agrupados (inclua Np)", ph: "6", hint: "circuitos" },
        { id: "Np",    label: "Np — cabos em paralelo por fase",            ph: "6",    hint: "cabos" },
        { id: "L",     label: "L — comprimento do trecho",                  ph: "115",  hint: "m" },
        { id: "K",     label: "K — queda de tensão do cabo (fabr.)",        ph: "0.21", hint: "V/A·km" },
        { id: "dVadm", label: "ΔV adm. — queda de tensão admissível",       ph: "4",    hint: "%" },
        { id: "Sesc",  label: "seção do cabo candidato (por unidade, opcional)", ph: "240", hint: "mm²", optional: true },
        { id: "Iz",    label: "Iz — capacidade de condução unitária (opcional)", ph: "607", hint: "A/cabo", optional: true },
      ],
      diagram: DIAGRAM_BT,
      example: { S: 2000, V: 460, isolacao: "xlpe", instalacao: "ao_ar", tempSolo: 35, nCircuitos: 6, Np: 6, L: 115, K: 0.21, dVadm: 4, Sesc: 240, Iz: 607 },
      calc(v: any) {
        const temCabo = validaBase(v);
        if (!Number.isInteger(v.Np) || v.Np < 1) throw new Error("Np deve ser um número inteiro ≥ 1");
        const fc = fatorInstalacao({ nivel: "BT", isolacao: v.isolacao, instalacao: v.instalacao, temp: v.tempSolo, resSolo: v.resSolo, profundidade: v.profundidade, nCircuitos: v.nCircuitos, espacamento: v.espacamento });

        const In = correnteNominal(v.S, v.V);
        const Ic = In * fc.Fc;
        const IcCabo = Ic / v.Np;
        const dV = quedaTensaoPct(v.K, v.L, In / v.Np, v.V);
        const dvOk = dV <= v.dVadm;

        const lines = [
          ...linhasInstalacao(v, fc),
          `── CORRENTES ────────────────────────`,
          `In (nominal):       ${In.toFixed(2)} A   (In = 1000·${v.S} / (√3·${v.V}))`,
          `Ic (corrigida):     ${Ic.toFixed(2)} A   (Ic = In × Fc = ${In.toFixed(2)} × ${fc.Fc.toFixed(3)})`,
          `Ic por cabo:        ${IcCabo.toFixed(2)} A   (Ic / Np = ${Ic.toFixed(2)} / ${v.Np})`,
          `→ cada cabo precisa ter Iz (tabela do fabricante, condição de referência) ≥ Ic/cabo`,
          `── QUEDA DE TENSÃO ──────────────────`,
          `ΔV calculada:       ${dV.toFixed(3)} %   (ΔV% = ${v.K}·${v.L}·${(In / v.Np).toFixed(2)} / (10·${v.V}); admissível ${v.dVadm.toFixed(2)} %)`,
          dvOk ? `✓ ΔV ≤ ΔV admissível` : `✗ ΔV > ΔV admissível — reduza L, aumente Np/seção ou revise K`,
        ];

        if (temCabo) {
          const IzTotal = v.Iz * v.Np;
          const ampOk = v.Iz >= IcCabo;
          const ratioAmp = IcCabo / v.Iz, ratioDv = dV / v.dVadm;
          const determinante = ratioAmp >= ratioDv ? "Capacidade de Condução" : "Queda de Tensão";
          const margAmp = ((v.Iz - IcCabo) / IcCabo) * 100;
          lines.push(
            `── CABO CANDIDATO ${v.Sesc} mm² × ${v.Np} ────`,
            `Iz unitário:        ${v.Iz.toFixed(0)} A`,
            `Iz total (Iz×Np):   ${IzTotal.toFixed(0)} A`,
            `Ic requerida/cabo:  ${IcCabo.toFixed(2)} A`,
            `Margem:             ${margAmp.toFixed(1)} %   ((Iz − Ic/cabo)/(Ic/cabo))`,
            ampOk ? `✓ Iz ≥ Ic/cabo — capacidade de condução OK` : `✗ Iz < Ic/cabo — AUMENTAR SEÇÃO OU Np`,
            `── RESULTADO ────────────────────────`,
            `Fator determinante: ${determinante}`,
            (ampOk && dvOk) ? `✓ ${v.Np}×${v.Sesc} mm² ATENDE aos critérios de BT` : `✗ ${v.Np}×${v.Sesc} mm² NÃO ATENDE — revisar seção/Np`,
          );
        } else {
          lines.push(
            `── REQUISITOS DO CABO BT ─────────────────`,
            `Iz mínimo necessário por cabo: ${IcCabo.toFixed(2)} A`,
            `→ procure no catálogo um cabo ${LABEL_ISOLACAO[v.isolacao as "pvc" | "xlpe"]} com Iz ≥ ${IcCabo.toFixed(2)} A no método de instalação escolhido`,
            `⚠ verifique também a seção mínima por curto-circuito`,
          );
        }
        return { val: lines.join("\n"), unit: "", multi: true };
      },
      result: "cabo BT",
    },

    /* ─────────────────────────────────────────────────────────────
       3. SEÇÃO MÍNIMA POR CURTO-CIRCUITO — fórmula adiabática
    ───────────────────────────────────────────────────────────── */
    {
      id: "curto_circuito",
      icon: "spark",
      name: "Seção Mínima do Cabo por Curto-Circuito",
      desc: "fórmula adiabática — suporte térmico do condutor à Icc",
      norma: "NBR 5410 §5.3.5",
      formula: "Smín = Icc · √t / k   (Icc em A, t em s, k em A·√s/mm²)",
      context: "Verifica a capacidade de suporte térmico (adiabático) de um condutor frente a uma corrente de curto-circuito (NBR 5410 §5.3.5.5.2 / IEC 60364-4-43, válida para t ≤ 5 s). Compara a seção mínima exigida com a seção candidata e sugere a próxima seção comercial. Constante k (A·√s/mm²) da NBR 5410 Tab. 30 para condutores de até 300 mm²: cobre+PVC 115, cobre+EPR/XLPE 143, alumínio+PVC 76, alumínio+EPR/XLPE 94. Este critério vira o \"fator determinante\" quando resulta em seção maior que a exigida por capacidade de condução ou queda de tensão.",
      fields: [
        { id: "Icc",  label: "Icc — corrente de curto-circuito",   ph: "25",  hint: "kA" },
        { id: "t",    label: "t — tempo de atuação da proteção",   ph: "0.5", hint: "s" },
        { id: "material", label: "Condutor / isolação (define k)", type: "select", options: K_OPCOES.map(({ value, label }) => ({ value, label })) },
        { id: "k",    label: "k — constante do material/isolação", ph: "115", hint: "A·√s/mm²", dependsOn: { id: "material", in: ["outro"] } },
        { id: "Sesc", label: "seção do cabo candidato (opcional)",  ph: "185", hint: "mm²", optional: true },
      ],
      example: { Icc: 25, t: 0.5, material: "cu_pvc", Sesc: 185 },
      calc(v: any) {
        if (!(v.Icc > 0)) throw new Error("Icc deve ser > 0");
        if (!(v.t > 0)) throw new Error("Tempo t deve ser > 0");
        const opt = K_OPCOES.find((o) => o.value === (v.material ?? "cu_pvc"));
        if (!opt) throw new Error("Material inválido");
        const k = opt.value === "outro" ? v.k : opt.k;
        if (!(k > 0)) throw new Error("Constante k deve ser > 0");
        const temSesc = v.Sesc !== undefined && v.Sesc !== null;
        if (temSesc && !(v.Sesc > 0)) throw new Error("Seção informada deve ser > 0");

        const IccA = v.Icc * 1000;
        const Smin = secaoCurto(IccA, v.t, k);
        const Ssug = secaoComercial(Smin);
        const ok = temSesc ? v.Sesc >= Smin : true;

        const lines = [
          `── CURTO-CIRCUITO (adiabática) ──────`,
          `Icc:              ${v.Icc.toFixed(2)} kA  (${IccA.toFixed(0)} A)`,
          `t (eliminação):   ${v.t.toFixed(3)} s`,
          `k:                ${k.toFixed(0)} A·√s/mm²  (${opt.value === "outro" ? "informado" : opt.label + " — NBR 5410 Tab. 30"})`,
          v.t > 5 ? `⚠ t > 5 s — fórmula adiabática fora da validade` : null,
          `── SEÇÃO ─────────────────────────────`,
          `Smín exigida:     ${Smin.toFixed(2)} mm²   (Smín = ${IccA.toFixed(0)}·√${v.t} / ${k})`,
          Ssug !== null ? `Seção comercial sugerida: ${Ssug} mm²` : `✗ Smín > 630 mm² — use condutores em paralelo ou reduza t`,
          temSesc ? `Seção informada:   ${v.Sesc.toFixed(1)} mm²` : `Seção informada:   não informada`,
          temSesc
            ? (ok ? `✓ Seção informada suporta a Icc` : `✗ Seção informada INSUFICIENTE — usar ≥ ${Ssug ?? "630+"} mm²`)
            : (Ssug !== null ? `→ Recomendação automática: usar no mínimo ${Ssug} mm²` : `→ Recomendação: dividir em cabos paralelos`),
        ].filter((l) => l !== null);
        return { val: lines.join("\n"), unit: "", multi: true };
      },
      result: "seção mín. Icc",
    },
    /* ─────────────────────────────────────────────────────────────
       4. SEÇÃO AUTOMÁTICA DO CABO (BT) — spec 008 L1
    ───────────────────────────────────────────────────────────── */
    {
      id: "secao_cabo",
      icon: "cable",
      name: "Seção do Cabo BT — Escolha Automática (NBR 5410)",
      desc: "menor seção que atende capacidade, queda de tensão e curto-circuito",
      norma: "NBR 5410 Tab. 36/37",
      formula: "Ib = P / (k·V·cosφ) | Iz' = Iz(tab)·Kt·Kg ≥ Ib | ΔV% = k·Ib·L·(R·cosφ + X·senφ)/V·100 ≤ ΔVadm | Smín = Icc·√t / k_ad | S = máx(S_capacidade, S_queda, S_curto)",
      context: "Escolhe a seção comercial do circuito de baixa tensão sem depender de catálogo, aplicando os três critérios da NBR 5410: (1) capacidade de condução — Iz das Tab. 36 (PVC 70 °C) e 37 (EPR/XLPE 90 °C) pelo método de referência (A1/A2 = eletroduto embutido em parede isolante; B1/B2 = eletroduto aparente/embutido em alvenaria com condutores isolados/cabo multipolar; C = cabo fixado diretamente em parede ou bandeja não perfurada; D = cabo em eletroduto enterrado), corrigido pelos fatores de temperatura (Tab. 40) e agrupamento (Tab. 42/45); (2) queda de tensão calculada com a resistência do condutor na temperatura de operação (IEC 60228, R20·[1 + α(θ − 20)]) e reatância típica de 0,08 Ω/km; (3) suporte térmico ao curto-circuito (fórmula adiabática, k da Tab. 30). k = √3 para circuito trifásico e 2 para monofásico. A seção adotada é a maior das três, e o relatório indica o critério determinante. Alumínio só a partir de 16 mm² e com Iz aproximado (0,78 × cobre) — confirme no catálogo.",
      fields: [
        { id: "modo",     label: "Corrente de projeto a partir de", type: "select", options: [{ value: "corrente", label: "Corrente Ib (A)" }, { value: "potencia", label: "Potência ativa P (kW)" }] },
        { id: "Ib",       label: "Ib — corrente de projeto", ph: "85", hint: "A", dependsOn: { id: "modo", in: ["corrente"] } },
        { id: "P",        label: "P — potência ativa da carga", ph: "45", hint: "kW", dependsOn: { id: "modo", in: ["potencia"] } },
        { id: "sistema",  label: "Sistema", type: "select", options: [{ value: "tri", label: "Trifásico (3 condutores carregados)" }, { value: "mono", label: "Monofásico / bifásico (2 condutores carregados)" }] },
        { id: "V",        label: "V — tensão (de linha no trifásico)", ph: "380", hint: "V" },
        { id: "fp",       label: "cos φ — fator de potência", ph: "0.92", hint: "—" },
        { id: "material", label: "Condutor", type: "select", options: [{ value: "cu", label: "Cobre" }, { value: "al", label: "Alumínio (≥ 16 mm², Iz aproximado)" }] },
        { id: "isolacao", label: "Isolação", type: "select", options: ISOLACAO_OPCOES },
        { id: "metodo",   label: "Método de referência (NBR 5410 Tab. 33)", type: "select", options: [
          { value: "B1", label: "B1 — condutores isolados em eletroduto aparente/embutido em alvenaria" },
          { value: "B2", label: "B2 — cabo multipolar em eletroduto aparente/embutido em alvenaria" },
          { value: "C",  label: "C — cabo fixado em parede ou bandeja não perfurada" },
          { value: "D",  label: "D — cabo em eletroduto enterrado" },
          { value: "A1", label: "A1 — condutores isolados em eletroduto em parede termicamente isolante" },
          { value: "A2", label: "A2 — cabo multipolar em eletroduto em parede termicamente isolante" },
        ] },
        { id: "temp",     label: "T — temperatura ambiente (solo no método D)", ph: "30", hint: "°C" },
        { id: "resSolo",  label: "ρ — resistividade térmica do solo", ph: "2.5", hint: "K·m/W", dependsOn: { id: "metodo", in: ["D"] } },
        { id: "nCircuitos", label: "n — circuitos agrupados", ph: "1", hint: "circuitos" },
        { id: "espacamento", label: "Espaçamento entre eletrodutos enterrados", type: "select", options: ESPACAMENTO_OPCOES.filter((o) => ["encostados", "0.25", "0.5", "1.0"].includes(o.value)), dependsOn: { id: "metodo", in: ["D"] } },
        { id: "L",        label: "L — comprimento do circuito", ph: "60", hint: "m" },
        { id: "dVadm",    label: "ΔV adm. — queda de tensão admissível", ph: "4", hint: "%" },
        { id: "Icc",      label: "Icc no início do circuito (opcional)", ph: "10", hint: "kA", optional: true },
        { id: "t",        label: "t — tempo de atuação da proteção (opcional, padrão 0,5)", ph: "0.5", hint: "s", optional: true },
      ],
      example: { modo: "corrente", Ib: 85, sistema: "tri", V: 380, fp: 0.92, material: "cu", isolacao: "pvc", metodo: "B1", temp: 30, nCircuitos: 1, L: 60, dVadm: 4, Icc: 10, t: 0.5 },
      calc(v: any) {
        const sistema = (v.sistema ?? "tri") as Sistema;
        if (!(v.V > 0)) throw new Error("Tensão V deve ser > 0");
        if (!(v.fp > 0 && v.fp <= 1)) throw new Error("cos φ deve estar entre 0 e 1");
        const Ib = v.modo === "potencia" ? (v.P > 0 ? correnteDePotencia(v.P, v.V, v.fp, sistema) : NaN) : v.Ib;
        if (!(Ib > 0)) throw new Error(v.modo === "potencia" ? "Potência P deve ser > 0" : "Ib deve ser > 0");
        if (!(v.L > 0)) throw new Error("Comprimento L deve ser > 0");
        if (!(v.dVadm > 0)) throw new Error("ΔV admissível deve ser > 0");
        if (v.Icc !== undefined && !(v.Icc > 0)) throw new Error("Icc deve ser > 0 (ou deixe em branco)");
        if (v.t !== undefined && !(v.t > 0)) throw new Error("t deve ser > 0 (ou deixe em branco)");
        const metodo = (v.metodo ?? "B1") as Metodo;
        const enterrado = metodo === "D";
        const fc = fatorInstalacao({
          nivel: "BT", isolacao: v.isolacao ?? "xlpe", instalacao: enterrado ? "enterrado_duto" : "ao_ar",
          temp: v.temp, resSolo: enterrado ? v.resSolo : undefined, profundidade: enterrado ? 0.7 : undefined,
          nCircuitos: v.nCircuitos, espacamento: v.espacamento,
        });
        const t = v.t ?? 0.5;
        const r = secaoAutomatica({ Ib, V: v.V, fp: v.fp, sistema, material: v.material ?? "cu", isolacao: v.isolacao ?? "xlpe", metodo, Kcorr: fc.Ktotal, L: v.L, dVadm: v.dVadm, Icc: v.Icc, t });
        const mat = v.material === "al" ? "Alumínio" : "Cobre";
        const lines: string[] = [
          `── CORRENTE DE PROJETO ───────────────`,
          v.modo === "potencia" ? `Ib = P/(${sistema === "tri" ? "√3" : "1"}·V·cosφ) = ${(v.P * 1000).toFixed(0)}/(${sistema === "tri" ? "1,732·" : ""}${v.V}·${v.fp}) = ${Ib.toFixed(2)} A` : `Ib = ${Ib.toFixed(2)} A (informada)`,
          `── FATORES DE CORREÇÃO ───────────────`,
          `Kt = ${fc.Kt.toFixed(2)} (${fc.refs.Kt})`,
          enterrado ? `Ks = ${fc.Ks.toFixed(2)} (${fc.refs.Ks})` : null,
          `Kg = ${fc.Kg.toFixed(2)} (${fc.refs.Kg})`,
          `K total = ${fc.Ktotal.toFixed(3)}   → Iz' = Iz(tab) × ${fc.Ktotal.toFixed(3)}`,
          ...fc.avisos,
          `── CRITÉRIO 1 · CAPACIDADE (${mat}, ${LABEL_ISOLACAO[v.isolacao as Isolacao ?? "xlpe"]}, método ${metodo}, ${r.carregados} carregados) ──`,
          r.porCapacidade ? `${r.porCapacidade.s} mm²: Iz = ${r.porCapacidade.iz} A → Iz' = ${r.porCapacidade.izCorr.toFixed(1)} A ≥ Ib ✓` : `✗ nenhuma seção até 300 mm² atende — use condutores em paralelo`,
          `── CRITÉRIO 2 · QUEDA DE TENSÃO (L = ${v.L} m) ──`,
          r.porQueda ? `${r.porQueda.s} mm²: R(${r.theta} °C) = ${r.porQueda.R.toFixed(4)} Ω/km, X = ${X_CABO_OHM_KM} Ω/km → ΔV = ${r.porQueda.dV.toFixed(2)} % ≤ ${v.dVadm} % ✓` : `✗ nenhuma seção até 300 mm² atende ΔV ≤ ${v.dVadm} % — reduza L ou use paralelo`,
          `── CRITÉRIO 3 · CURTO-CIRCUITO ───────`,
          r.porCurto ? `Smín = ${(v.Icc * 1000).toFixed(0)}·√${t} / ${r.k} = ${r.sMinCurto.toFixed(1)} mm² → ${r.porCurto.s} mm² ✓` : (v.Icc ? `✗ Smín = ${r.sMinCurto.toFixed(1)} mm² > 300 mm²` : `não verificado (Icc não informada) ⚠ use o cálculo "Corrente de curto-circuito"`),
          `── RESULTADO ─────────────────────────`,
        ].filter((l): l is string => l !== null);
        const links: any[] = [];
        if (r.adotada) {
          lines.push(
            `✓ SEÇÃO ADOTADA: ${r.adotada.s} mm² (${mat})`,
            `Fator determinante: ${r.determinante}`,
            `Iz' da seção adotada = ${r.adotada.izCorr.toFixed(1)} A   ΔV = ${r.adotada.dV.toFixed(2)} %`,
            `⚠ Iz de tabela [CONFIRMAR NA NORMA]; condutor de proteção e neutro não dimensionados aqui`,
          );
          links.push({ label: `Escolher o disjuntor (Ib = ${Ib.toFixed(1)} A, Iz = ${r.adotada.izCorr.toFixed(1)} A)`, area: "eletrica", calcId: "disjuntor", values: { Ib: +Ib.toFixed(2), Iz: +r.adotada.izCorr.toFixed(1) } });
        } else lines.push(`✗ Nenhuma seção até 300 mm² atende os três critérios — divida o circuito ou use cabos em paralelo`);
        return { val: lines.join("\n"), unit: "", multi: true, links };
      },
      result: "seção do cabo",
    },

    /* ─────────────────────────────────────────────────────────────
       5. CORRENTE DE CURTO-CIRCUITO — spec 008 L2
    ───────────────────────────────────────────────────────────── */
    {
      id: "icc",
      icon: "spark",
      name: "Corrente de Curto-Circuito (Trafo + Cabo)",
      desc: "Icc trifásica no secundário do transformador e no fim do cabo",
      norma: "IEC 60909 (simplificado)",
      formula: "Z_T = (Z%/100)·V² / S | R_T = Z_T/√(1 + (X/R)²), X_T = R_T·(X/R) | R_C = R20·L/n, X_C = 0,08·L/n | Icc = V / (√3·|Z_T + Z_C|)",
      context: "Calcula a corrente de curto-circuito trifásica simétrica, dado que quase nunca o engenheiro tem esse valor em mãos. Considera a rede a montante como infinita (potência de curto muito maior que a do transformador) e fator de tensão c = 1 — simplificação da IEC 60909 que leva a valores próximos do máximo, adequados para verificar o suporte térmico dos cabos e a capacidade de interrupção dos disjuntores. A impedância do transformador vem da tensão de curto-circuito Z% (placa) e da relação X/R típica (≈ 5 para 500–2000 kVA). Opcionalmente soma a impedância do cabo (resistência a 20 °C, IEC 60228, que dá o maior Icc, e reatância típica de 0,08 Ω/km) para obter o Icc no fim do circuito.",
      fields: [
        { id: "S",   label: "S — potência do transformador", ph: "1000", hint: "kVA" },
        { id: "V",   label: "V — tensão secundária de linha", ph: "380", hint: "V" },
        { id: "Z",   label: "Z% — impedância percentual (placa)", ph: "5", hint: "%" },
        { id: "XR",  label: "X/R do transformador (opcional, padrão 5)", ph: "5", hint: "—", optional: true },
        { id: "secao", label: "seção do cabo (opcional)", ph: "95", hint: "mm²", optional: true },
        { id: "material", label: "Condutor do cabo", type: "select", options: [{ value: "cu", label: "Cobre" }, { value: "al", label: "Alumínio" }] },
        { id: "L",   label: "L — comprimento do cabo (opcional)", ph: "50", hint: "m", optional: true },
        { id: "np",  label: "cabos em paralelo por fase (opcional, padrão 1)", ph: "1", hint: "cabos", optional: true },
      ],
      example: { S: 1000, V: 380, Z: 5, XR: 5, secao: 95, material: "cu", L: 50, np: 1 },
      calc(v: any) {
        if (!(v.S > 0)) throw new Error("Potência S deve ser > 0");
        if (!(v.V > 0)) throw new Error("Tensão V deve ser > 0");
        if (!(v.Z > 0 && v.Z < 30)) throw new Error("Z% deve estar entre 0 e 30");
        const XR = v.XR ?? 5;
        if (!(XR > 0)) throw new Error("X/R deve ser > 0");
        const np = v.np ?? 1;
        if (!Number.isInteger(np) || np < 1) throw new Error("Nº de cabos em paralelo deve ser inteiro ≥ 1");
        const comCabo = v.secao !== undefined || v.L !== undefined;
        if (comCabo && !(v.secao > 0 && v.L > 0)) throw new Error("Para incluir o cabo informe a seção e o comprimento L");
        const In = correnteNominal(v.S, v.V);
        const T = impedanciaTrafo(v.S, v.V, v.Z, XR);
        const IccT = iccTrifasica(v.V, T.R, T.X);
        const lines = [
          `── TRANSFORMADOR ─────────────────────`,
          `In = ${(v.S * 1000).toFixed(0)}/(√3·${v.V}) = ${In.toFixed(1)} A`,
          `Z_T = (${v.Z}/100)·${v.V}²/${(v.S * 1000).toFixed(0)} = ${(T.Z * 1000).toFixed(3)} mΩ`,
          `R_T = ${(T.R * 1000).toFixed(3)} mΩ   X_T = ${(T.X * 1000).toFixed(3)} mΩ   (X/R = ${XR})`,
          `Icc no secundário = ${(IccT / 1000).toFixed(2)} kA   (= In/Z% = ${(In / (v.Z / 100) / 1000).toFixed(2)} kA)`,
        ];
        let IccFim = IccT;
        if (comCabo) {
          const mat = (v.material ?? "cu") as Material;
          const R20 = resistenciaCondutor(mat, v.secao, 20);
          if (R20 === null) throw new Error(`Seção ${v.secao} mm² não tabelada para ${mat === "cu" ? "cobre" : "alumínio"} (use 1,5–300 mm²; Al ≥ 16)`);
          const Rc = (R20 * v.L / 1000) / np, Xc = (X_CABO_OHM_KM * v.L / 1000) / np;
          IccFim = iccTrifasica(v.V, T.R + Rc, T.X + Xc);
          lines.push(
            `── CABO ${np > 1 ? np + "×" : ""}${v.secao} mm² ${mat === "cu" ? "Cu" : "Al"}, L = ${v.L} m ──`,
            `R_C = ${R20.toFixed(4)} Ω/km·${v.L} m${np > 1 ? "/" + np : ""} = ${(Rc * 1000).toFixed(3)} mΩ   X_C = ${(Xc * 1000).toFixed(3)} mΩ`,
            `|Z| total = ${(Math.hypot(T.R + Rc, T.X + Xc) * 1000).toFixed(3)} mΩ`,
            `Icc no fim do cabo = ${(IccFim / 1000).toFixed(2)} kA`,
          );
        }
        lines.push(
          `── USO ───────────────────────────────`,
          `→ capacidade de interrupção do disjuntor no ponto ≥ ${(IccFim / 1000).toFixed(1)} kA`,
          `⚠ rede a montante infinita e c = 1 — para estudo de seletividade use a IEC 60909 completa`,
        );
        const IccLink = +(IccT / 1000).toFixed(2);
        return {
          val: lines.join("\n"), unit: "", multi: true,
          links: [{ label: `Verificar seção mínima do cabo para Icc = ${IccLink} kA`, area: "eletrica", calcId: "curto_circuito", values: { Icc: IccLink, t: 0.5 } }],
        };
      },
      result: "corrente de curto",
    },

    /* ─────────────────────────────────────────────────────────────
       6. DISJUNTOR / COORDENAÇÃO — spec 008 L3
    ───────────────────────────────────────────────────────────── */
    {
      id: "disjuntor",
      icon: "bolt",
      name: "Disjuntor — Coordenação com o Condutor",
      desc: "In comercial com Ib ≤ In ≤ Iz e I2 ≤ 1,45·Iz",
      norma: "NBR 5410 §5.3.4",
      formula: "Ib ≤ In ≤ Iz | I2 ≤ 1,45·Iz | I2 = 1,45·In (NBR NM 60898) ou 1,30·In (NBR IEC 60947-2)",
      context: "Escolhe a corrente nominal do disjuntor que protege o condutor contra sobrecarga, conforme NBR 5410 §5.3.4.1: a corrente nominal In deve ficar entre a corrente de projeto Ib e a capacidade de condução corrigida Iz do condutor, e a corrente convencional de atuação I2 não pode passar de 1,45·Iz. Para disjuntores residenciais (NBR NM 60898) I2 = 1,45·In; para industriais (NBR IEC 60947-2) I2 = 1,30·In. A curva (B, C ou D) define a faixa de disparo magnético: B = 3 a 5·In (cargas resistivas), C = 5 a 10·In (uso geral, iluminação, pequenos motores), D = 10 a 20·In (motores e transformadores com alta corrente de partida).",
      fields: [
        { id: "Ib",   label: "Ib — corrente de projeto", ph: "28", hint: "A" },
        { id: "Iz",   label: "Iz — capacidade de condução corrigida do cabo", ph: "41", hint: "A" },
        { id: "norma", label: "Tipo de disjuntor", type: "select", options: [{ value: "60898", label: "Residencial / predial — NBR NM 60898 (I2 = 1,45·In)" }, { value: "60947", label: "Industrial — NBR IEC 60947-2 (I2 = 1,30·In)" }] },
        { id: "curva", label: "Curva de disparo", type: "select", options: [{ value: "C", label: "C — uso geral (5–10·In)" }, { value: "B", label: "B — resistivas (3–5·In)" }, { value: "D", label: "D — motores/trafos (10–20·In)" }] },
      ],
      example: { Ib: 28, Iz: 41, norma: "60898", curva: "C" },
      calc(v: any) {
        if (!(v.Ib > 0)) throw new Error("Ib deve ser > 0");
        if (!(v.Iz > 0)) throw new Error("Iz deve ser > 0");
        if (v.Iz < v.Ib) throw new Error(`Iz (${v.Iz} A) < Ib (${v.Ib} A): o condutor não suporta a carga — aumente a seção`);
        const fI2 = v.norma === "60947" ? 1.3 : 1.45;
        const d = escolherDisjuntor(v.Ib, v.Iz, fI2);
        const faixa: Record<string, [number, number]> = { B: [3, 5], C: [5, 10], D: [10, 20] };
        const [m1, m2] = faixa[v.curva ?? "C"]!;
        const lines = [
          `── CONDIÇÃO 1 · Ib ≤ In ≤ Iz ──────────`,
          d.In === null ? `✗ Ib > 1600 A — fora da faixa de disjuntores` : `In = ${d.In} A   (${v.Ib} ≤ ${d.In} ≤ ${v.Iz}) ${d.ok1 ? "✓" : "✗"}`,
          `── CONDIÇÃO 2 · I2 ≤ 1,45·Iz ──────────`,
          d.In === null ? `—` : `I2 = ${fI2.toFixed(2)}·${d.In} = ${d.I2.toFixed(1)} A ≤ 1,45·${v.Iz} = ${(1.45 * v.Iz).toFixed(1)} A ${d.ok2 ? "✓" : "✗"}`,
          `── RESULTADO ─────────────────────────`,
        ];
        if (d.In !== null && d.ok1 && d.ok2) lines.push(
          `✓ Disjuntor ${d.In} A, curva ${v.curva ?? "C"}`,
          `Disparo magnético: ${m1 * d.In}–${m2 * d.In} A`,
          `⚠ verifique também a capacidade de interrupção ≥ Icc no ponto`,
        );
        else lines.push(`✗ Nenhum In comercial fica entre Ib e Iz — aumente a seção do condutor (Iz) e refaça`);
        return { val: lines.join("\n"), unit: "", multi: true };
      },
      result: "disjuntor",
    },

    /* ─────────────────────────────────────────────────────────────
       7. CORREÇÃO DO FATOR DE POTÊNCIA — spec 008 L4
    ───────────────────────────────────────────────────────────── */
    {
      id: "fator_potencia",
      icon: "chart",
      name: "Correção do Fator de Potência — Banco de Capacitores",
      desc: "kvar necessários para levar o FP ao valor desejado (mín. 0,92)",
      norma: "ANEEL REN 1000/2021",
      formula: "Qc = P·(tan φ1 − tan φ2) | φ = acos(FP) | Ic = 1000·Qc / (√3·V) | FP' = P / √(P² + (Q − Qc)²)",
      context: "Dimensiona o banco de capacitores para corrigir o fator de potência de uma instalação. A ANEEL cobra excedente de energia reativa quando o fator de potência fica abaixo de 0,92. A potência reativa a compensar é a diferença entre a reativa atual (P·tan φ1) e a desejada (P·tan φ2). O relatório sugere o banco comercial imediatamente acima, verifica se ele não sobrecompensa (FP capacitivo) e mostra a redução da corrente total — que libera capacidade em cabos e transformador.",
      fields: [
        { id: "P",   label: "P — potência ativa da instalação", ph: "100", hint: "kW" },
        { id: "fp1", label: "FP atual", ph: "0.80", hint: "—" },
        { id: "fp2", label: "FP desejado", ph: "0.92", hint: "—" },
        { id: "V",   label: "V — tensão de linha", ph: "380", hint: "V" },
      ],
      example: { P: 100, fp1: 0.8, fp2: 0.92, V: 380 },
      calc(v: any) {
        if (!(v.P > 0)) throw new Error("P deve ser > 0");
        if (!(v.fp1 > 0 && v.fp1 < 1)) throw new Error("FP atual deve estar entre 0 e 1");
        if (!(v.fp2 > 0 && v.fp2 <= 1)) throw new Error("FP desejado deve estar entre 0 e 1");
        if (!(v.V > 0)) throw new Error("V deve ser > 0");
        if (v.fp2 <= v.fp1) throw new Error("FP desejado deve ser maior que o atual");
        const Qc = potenciaCapacitor(v.P, v.fp1, v.fp2);
        const banco = BANCOS_KVAR.find((b) => b >= Qc - 1e-9) ?? null;
        const Q1 = v.P * Math.tan(Math.acos(v.fp1));
        const S1 = v.P / v.fp1;
        const lines = [
          `── SITUAÇÃO ATUAL ────────────────────`,
          `φ1 = acos(${v.fp1}) → tan φ1 = ${Math.tan(Math.acos(v.fp1)).toFixed(4)}   Q1 = ${Q1.toFixed(2)} kvar`,
          `S1 = ${S1.toFixed(2)} kVA   I1 = ${((S1 * 1000) / (SQRT3 * v.V)).toFixed(1)} A`,
          `── COMPENSAÇÃO ───────────────────────`,
          `tan φ2 = ${Math.tan(Math.acos(v.fp2)).toFixed(4)}`,
          `Qc = ${v.P}·(${Math.tan(Math.acos(v.fp1)).toFixed(4)} − ${Math.tan(Math.acos(v.fp2)).toFixed(4)}) = ${Qc.toFixed(2)} kvar`,
          v.fp1 < 0.92 ? `⚠ FP atual < 0,92 — sujeito a cobrança de reativo excedente (ANEEL)` : `FP atual já ≥ 0,92`,
          `── BANCO COMERCIAL ───────────────────`,
        ];
        if (banco !== null) {
          const fpN = fpResultante(v.P, v.fp1, banco);
          const S2 = v.P / Math.abs(fpN);
          lines.push(
            `Banco sugerido: ${banco} kvar   Ic = ${((banco * 1000) / (SQRT3 * v.V)).toFixed(1)} A`,
            `FP resultante = ${Math.abs(fpN).toFixed(3)} ${fpN < 0 ? "capacitivo ✗ sobrecompensado — use banco menor ou automático" : "indutivo ✓"}`,
            `Nova corrente: ${((S2 * 1000) / (SQRT3 * v.V)).toFixed(1)} A (−${(100 * (1 - S2 / S1)).toFixed(1)} %)`,
          );
        } else lines.push(`Qc > 100 kvar — use banco automático em estágios (ex.: ${Math.ceil(Qc / 25)} × 25 kvar)`);
        return { val: lines.join("\n"), unit: "", multi: true };
      },
      result: "banco de capacitores",
    },

    /* ─────────────────────────────────────────────────────────────
       8. CORRENTE DE MOTOR — spec 008 L5
    ───────────────────────────────────────────────────────────── */
    {
      id: "motor",
      icon: "rotate",
      name: "Corrente de Motor Elétrico",
      desc: "corrente nominal e de partida a partir de cv/kW, η e cos φ",
      norma: "NBR 17094 / NBR 5410 §6.5.1",
      formula: "P(W) = cv·735,5 ou kW·1000 | In = P / (k·V·η·cosφ), k = √3 (tri) ou 1 (mono) | Ip = In·(Ip/In) | Ib = 1,25·In",
      context: "Calcula a corrente nominal de um motor de indução a partir da potência de placa (no eixo), do rendimento η e do fator de potência — dados da placa ou do catálogo do fabricante. A corrente de partida (Ip/In de 6 a 8 para partida direta) serve para escolher a curva do disjuntor e verificar a queda de tensão na partida. Para o circuito terminal de um único motor usa-se como corrente de projeto 1,25·In (NBR 5410 §6.5.1 [CONFIRMAR NA NORMA]), que é levada para o cálculo da seção do cabo.",
      fields: [
        { id: "unidade", label: "Unidade da potência", type: "select", options: [{ value: "cv", label: "cv" }, { value: "kw", label: "kW" }] },
        { id: "P",   label: "P — potência no eixo (placa)", ph: "10", hint: "cv/kW" },
        { id: "sistema", label: "Sistema", type: "select", options: [{ value: "tri", label: "Trifásico" }, { value: "mono", label: "Monofásico" }] },
        { id: "V",   label: "V — tensão (de linha no trifásico)", ph: "380", hint: "V" },
        { id: "eta", label: "η — rendimento", ph: "0.88", hint: "—" },
        { id: "fp",  label: "cos φ — fator de potência", ph: "0.85", hint: "—" },
        { id: "IpIn", label: "Ip/In — corrente de partida (opcional, padrão 7)", ph: "7", hint: "×", optional: true },
      ],
      example: { unidade: "cv", P: 10, sistema: "tri", V: 380, eta: 0.88, fp: 0.85, IpIn: 7 },
      calc(v: any) {
        if (!(v.P > 0)) throw new Error("P deve ser > 0");
        if (!(v.V > 0)) throw new Error("V deve ser > 0");
        if (!(v.eta > 0 && v.eta <= 1)) throw new Error("η deve estar entre 0 e 1");
        if (!(v.fp > 0 && v.fp <= 1)) throw new Error("cos φ deve estar entre 0 e 1");
        const IpIn = v.IpIn ?? 7;
        if (!(IpIn >= 1)) throw new Error("Ip/In deve ser ≥ 1");
        const sistema = (v.sistema ?? "tri") as Sistema;
        const PW = v.unidade === "kw" ? v.P * 1000 : v.P * CV_W;
        const In = correnteMotor(PW, v.V, v.eta, v.fp, sistema);
        const Ib = 1.25 * In;
        const lines = [
          `── POTÊNCIA ──────────────────────────`,
          `P = ${v.P} ${v.unidade === "kw" ? "kW" : "cv"} = ${PW.toFixed(1)} W (no eixo)`,
          `P absorvida = P/η = ${(PW / v.eta / 1000).toFixed(2)} kW   S = ${(PW / v.eta / v.fp / 1000).toFixed(2)} kVA`,
          `── CORRENTES ─────────────────────────`,
          `In = ${PW.toFixed(1)}/(${sistema === "tri" ? "√3·" : ""}${v.V}·${v.eta}·${v.fp}) = ${In.toFixed(2)} A`,
          `Ip = ${IpIn}·In = ${(IpIn * In).toFixed(1)} A (partida direta)`,
          `Ib (circuito do motor) = 1,25·In = ${Ib.toFixed(2)} A`,
          `── PROTEÇÃO ──────────────────────────`,
          `→ disjuntor-motor ou curva D (Ip/In = ${IpIn}); considere partida estrela-triângulo/soft-starter acima de ~7,5 cv conforme concessionária`,
        ];
        return {
          val: lines.join("\n"), unit: "", multi: true,
          links: [{ label: `Escolher a seção do cabo (Ib = ${Ib.toFixed(1)} A)`, area: "eletrica", calcId: "secao_cabo", values: { modo: "corrente", Ib: +Ib.toFixed(2), sistema, V: v.V, fp: v.fp } }],
        };
      },
      result: "corrente do motor",
    },
  ],
};
