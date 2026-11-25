/**
 * Exemplos resolvidos publicados — aparecem como botões "exemplo do livro" na folha
 * e são conferidos automaticamente em test/referencias.test.ts.
 * `expected` usa o id dos passos (Step.id) de cada cálculo; a tolerância cobre o
 * arredondamento que a própria fonte faz nos valores intermediários.
 * Detalhes, páginas e divergências encontradas: packages/core/test/REFERENCIAS.md
 */
import type { Reference } from "./lib/steps.js";

const BASTOS_FLEXAO = "https://wwwp.feb.unesp.br/pbastos/concreto1/FlexaoSimples.pdf";
const BASTOS_CORTANTE = "https://wwwp.feb.unesp.br/pbastos/concreto2/Cortante.pdf";
const BASTOS_ANCORAGEM = "https://wwwp.feb.unesp.br/pbastos/concreto2/Ancoragem.pdf";
const PRYSMIAN = "https://br.prysmian.com/sites/default/files/atoms/files/Guia_de_Dimensionamento-Baixa_Tensao_Rev9.pdf";
const TRF2 = "https://trf2.jus.br/system/files/2026/07/memorial_curto_circuito.pdf";
const WEG = "https://static.weg.net/medias/downloadcenter/h6f/h9f/WEG-correcion-del-factor-de-potencia-50034873-catalogo-es.pdf";

/** O app estima d = h − cob − 1,63 cm; o livro dá d direto. Este cob reproduz o d do livro. */
const cobPara = (h: number, d: number) => Number((h - d - 1.63).toFixed(2));
const NOTA_D = (h: number, d: number) =>
  `O livro informa d = ${d} cm. O app calcula d = h − cob − 1,63 cm, então o cobrimento foi ajustado para ${String(cobPara(h, d)).replace(".", ",")} cm para chegar no mesmo d.`;

export const REFS_CIVIL: Record<string, Reference[]> = {
  concreto: [
    {
      id: "bastos-flexao-1", label: "Bastos — Flexão, ex. 1",
      source: "Bastos (UNESP), Flexão Normal Simples – Vigas, NBR 6118:2023", where: "item 7.3, 1º exemplo (pág. 21–23 do PDF)", url: BASTOS_FLEXAO,
      note: `Viga 20×50, C20, CA-50, Mk = 100 kN·m (Md = 140 kN·m). ${NOTA_D(50, 47)} O cortante não faz parte deste exemplo.`,
      values: { L: 1, bw: 20, h: 50, cob: cobPara(50, 47), fck: 20, fyk: 500, gk: 0, qk: 0, Mdinf: 140 },
      expected: { x: { value: 18.1, tol: 0.1 }, As: { value: 8.10, tol: 0.02 }, AsMin: { value: 1.50, tol: 0.01 } },
    },
    {
      id: "bastos-flexao-3", label: "Bastos — Flexão, ex. 3",
      source: "Bastos (UNESP), Flexão Normal Simples – Vigas, NBR 6118:2023", where: "item 7.3, 3º exemplo (pág. 32 do PDF)", url: BASTOS_FLEXAO,
      note: `Seção de apoio 22×60, C25, CA-50, Mk = −150 kN·m (Md = 210 kN·m). ${NOTA_D(60, 55)} O cortante não faz parte deste exemplo.`,
      values: { L: 1, bw: 22, h: 60, cob: cobPara(60, 55), fck: 25, fyk: 500, gk: 0, qk: 0, Mdinf: 210 },
      expected: { x: { value: 16.2, tol: 0.1 }, As: { value: 9.95, tol: 0.02 }, AsMin: { value: 1.98, tol: 0.01 } },
    },
    {
      id: "bastos-cortante-1", label: "Bastos — Cortante, ex. 1",
      source: "Bastos (UNESP), Dimensionamento de Vigas à Força Cortante, NBR 6118:2023", where: "item 5.15, Exemplo Numérico 1, Modelo I (pág. 45–47 do PDF)", url: BASTOS_CORTANTE,
      note: `Viga biapoiada de 5 m, 14×50, C25, carga de 43,7 kN/m. ${NOTA_D(50, 46)} Só o cortante faz parte deste exemplo, por isso o Md foi informado com um valor simbólico (1 kN·m).`,
      values: { L: 5, bw: 14, h: 50, cob: cobPara(50, 46), fck: 25, fyk: 500, gk: 43.7, qk: 0, Mdinf: 1 },
      expected: {
        Vsd: { value: 153.0, tol: 0.1 }, Vrd2: { value: 279.5, tol: 0.2 }, Vc: { value: 49.6, tol: 0.1 },
        Vsw: { value: 103.4, tol: 0.1 }, AswS: { value: 5.73, tol: 0.02 }, AswMin: { value: 1.44, tol: 0.01 },
      },
    },
  ],
  ancoragem: [
    {
      id: "bastos-a1-16-c25", label: "Bastos — Tab. A-1: φ16, C25",
      source: "Bastos (UNESP), Ancoragem e Emenda de Armaduras", where: "Tabela A-1, CA-50 nervurado (pág. 28 do PDF)", url: BASTOS_ANCORAGEM,
      note: "Boa aderência, sem gancho: a tabela dá 60 cm (valor arredondado).",
      values: { phi: 16, fck: 25, fyk: 500, barra: "nervurada", aderencia: "boa", gancho: "reta", emendadas: "50" },
      expected: { lbnec: { value: 60, tol: 1 } },
    },
    {
      id: "bastos-a1-16-c25-ma", label: "Bastos — Tab. A-1: φ16, C25, má aderência",
      source: "Bastos (UNESP), Ancoragem e Emenda de Armaduras", where: "Tabela A-1, CA-50 nervurado (pág. 28 do PDF)", url: BASTOS_ANCORAGEM,
      note: "Má aderência, sem gancho: a tabela dá 86 cm.",
      values: { phi: 16, fck: 25, fyk: 500, barra: "nervurada", aderencia: "ma", gancho: "reta", emendadas: "50" },
      expected: { lbnec: { value: 86, tol: 1 } },
    },
    {
      id: "bastos-a1-20-c30-gancho", label: "Bastos — Tab. A-1: φ20, C30, com gancho",
      source: "Bastos (UNESP), Ancoragem e Emenda de Armaduras", where: "Tabela A-1, CA-50 nervurado (pág. 28 do PDF)", url: BASTOS_ANCORAGEM,
      note: "Boa aderência, com gancho: a tabela dá 47 cm.",
      values: { phi: 20, fck: 30, fyk: 500, barra: "nervurada", aderencia: "boa", gancho: "gancho", emendadas: "50" },
      expected: { lbnec: { value: 47, tol: 1 } },
    },
  ],
};

export const REFS_ELETRICA: Record<string, Reference[]> = {
  curto_circuito: [
    {
      id: "prysmian-7", label: "Prysmian — exemplo do item 7",
      source: "Prysmian, Guia de Dimensionamento de Cabos para Baixa Tensão, Rev. 9", where: "item 7, exemplo (pág. 44 do PDF)", url: PRYSMIAN,
      note: "Icc = 10 kA, proteção atua em 0,5 s, cabo de cobre com isolação HEPR/XLPE (k = 143). O guia chega a 49,44 mm² e indica 50 mm².",
      values: { Icc: 10, t: 0.5, material: "cu_xlpe" },
      expected: { Smin: { value: 49.44, tol: 0.01 }, Ssug: { value: 50, tol: 0 } },
    },
  ],
  icc: [
    {
      id: "trf2-1000kva", label: "Memorial TRF2 — trafo 1000 kVA",
      source: "TRF 2ª Região, Memorial de Cálculo de Curto-Circuito (método do Cotrim, Instalações Elétricas, 5ª ed.)", where: "Etapa 1 (pág. 1–2 do PDF)", url: TRF2,
      note: "Transformador de 1000 kVA, 220 V, Z = 6,45 %, sem cabo. O memorial escreve In ≈ 2624,5 A; o valor exato é 2624,3 A (diferença de arredondamento de √3).",
      values: { S: 1000, V: 220, Z: 6.45, XR: 5, material: "cu" },
      expected: { In: { value: 2624.5, tol: 0.5 }, IccT: { value: 40.69, tol: 0.01 } },
    },
  ],
  fator_potencia: [
    {
      id: "weg-930kw", label: "WEG — carga de 930 kW",
      source: "WEG, Corrección del Factor de Potencia (catálogo 50034873)", where: "exemplo de 930 kW (pág. 8 do PDF)", url: WEG,
      note: "Carga de 930 kW em 380 V com FP 0,65, corrigida para 0,92. O catálogo calcula a potência aparente e a corrente antes da correção.",
      values: { P: 930, fp1: 0.65, fp2: 0.92, V: 380 },
      expected: { S1: { value: 1431, tol: 1 }, I1: { value: 2174, tol: 1 } },
    },
    {
      id: "weg-motor-55kw", label: "WEG — motor de 55 kW",
      source: "WEG, Corrección del Factor de Potencia (catálogo 50034873)", where: "exemplo do motor W22 55 kW (pág. 11 do PDF)", url: WEG,
      note: "Motor de 55 kW a 75 % de carga, η = 93,2 % → potência absorvida = 0,75·55/0,932 = 44,26 kW. Atenção: o catálogo diz FP 0,85, mas usa o fator da linha 0,84 da tabela (F = 0,220). Com 0,84 o resultado bate com os 9,73 kvar do catálogo; com 0,85 o correto seria 8,58 kvar.",
      values: { P: 44.26, fp1: 0.84, fp2: 0.92, V: 400 },
      expected: { Qc: { value: 9.73, tol: 0.02 } },
    },
  ],
};
