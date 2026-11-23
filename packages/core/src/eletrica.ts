/**
 * EngCalc — ELÉTRICA
 * Cabos MT/BT (capacidade de condução + queda de tensão) e seção mínima por curto-circuito.
 * Fatores de correção: lib/nbr5410.ts (tabelas com a origem comentada).
 */
import { fatorInstalacao, LABEL_ISOLACAO, LABEL_ESPACAMENTO, type FatorResult } from "./lib/nbr5410.js";

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
  ],
};
