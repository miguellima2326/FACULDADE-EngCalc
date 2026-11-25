import React from "react";
import {
  BARRAS, TAB_17_3, ancoragem, izTabela, resistenciaCondutor, SECOES_IZ, K_ADIABATICO, METODOS, SECAO_MIN_AL,
  DISJUNTORES_IN, BANCOS_KVAR, ROSCAS, MODULOS_I, MODULOS_II, MATERIAIS_EIXO, propriedadesClasse,
} from "@engcalc/core";
import { br } from "./steps.js";

/* ═══════════ Tabelas de consulta — os mesmos dados que os cálculos usam ═══════════ */

type Sec = { id: string; title: string; area: string; source: string; body: React.ReactNode };

function Table({ head, rows, numFrom = 1 }: { head: React.ReactNode[]; rows: React.ReactNode[][]; numFrom?: number }) {
  return <div className="tbl-wrap"><table className="cmp-table tbl">
    <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j >= numFrom ? "num" : ""}>{c}</td>)}</tr>)}</tbody>
  </table></div>;
}

function IzTable() {
  const [mat, setMat] = React.useState<"cu" | "al">("cu");
  const [iso, setIso] = React.useState<"pvc" | "xlpe">("pvc");
  const [carr, setCarr] = React.useState<2 | 3>(3);
  const secoes = SECOES_IZ.filter((s) => mat === "cu" || s >= SECAO_MIN_AL);
  return <>
    <div className="tbl-filters">
      <select aria-label="Condutor" value={mat} onChange={(e) => setMat(e.target.value as "cu" | "al")}><option value="cu">Cobre</option><option value="al">Alumínio (aprox.)</option></select>
      <select aria-label="Isolação" value={iso} onChange={(e) => setIso(e.target.value as "pvc" | "xlpe")}><option value="pvc">PVC 70 °C (Tab. 36)</option><option value="xlpe">EPR/XLPE 90 °C (Tab. 37)</option></select>
      <select aria-label="Condutores carregados" value={carr} onChange={(e) => setCarr(Number(e.target.value) as 2 | 3)}><option value={3}>3 carregados (trifásico)</option><option value={2}>2 carregados (mono/bifásico)</option></select>
    </div>
    <Table head={["Seção (mm²)", ...METODOS]} rows={secoes.map((s) => [br(s, s < 10 ? 1 : 0), ...METODOS.map((m) => { const iz = izTabela(mat, iso, carr, m, s); return iz === null ? "—" : br(iz, iz % 1 ? 1 : 0); })])} />
  </>;
}

const SECOES: Sec[] = [
  {
    id: "barras", title: "Barras de aço — área e massa", area: "Civil", source: "Área = π·φ²/4; massa = área × 0,785 kg/(cm²·m) (aço 7850 kg/m³)",
    body: <Table head={["φ (mm)", "Área (cm²)", "Massa (kg/m)", "2 barras", "3 barras", "4 barras", "5 barras", "6 barras"]}
      rows={BARRAS.map((b: any) => [br(b.phi, b.phi % 1 ? 1 : 0), br(b.area, 3), br(b.area * 0.785, 3), ...[2, 3, 4, 5, 6].map((k) => br(k * b.area))])} />,
  },
  {
    id: "ancoragem", title: "Comprimento de ancoragem básico lb (cm) — CA-50 nervurado, sem gancho", area: "Civil", source: "NBR 6118 §9.4.2.4: lb = (φ/4)·(fyd/fbd) ≥ 25φ. Em cada célula: boa aderência / má aderência. Com gancho: multiplique por 0,7.",
    body: <Table head={["φ (mm)", "C20", "C25", "C30", "C35", "C40", "C45", "C50"]}
      rows={[6.3, 8, 10, 12.5, 16, 20, 25, 32].map((phi) => [br(phi, phi % 1 ? 1 : 0), ...[20, 25, 30, 35, 40, 45, 50].map((fck) => {
        const boa = ancoragem({ phi, fck, fyk: 500, barra: "nervurada", boa: true }).lb / 10;
        const ma = ancoragem({ phi, fck, fyk: 500, barra: "nervurada", boa: false }).lb / 10;
        return `${br(boa, 0)} / ${br(ma, 0)}`;
      })])} />,
  },
  {
    id: "rhomin", title: "Taxa mínima de armadura de flexão ρmín", area: "Civil", source: "NBR 6118 Tab. 17.3 — seção retangular, CA-50 (As,mín = ρmín·bw·h)",
    body: <Table head={["Concreto", "ρmín (%)"]} rows={TAB_17_3.map(([fck, r]) => [`C${fck}`, br(r * 100, 3)])} />,
  },
  { id: "iz", title: "Capacidade de condução de corrente Iz (A)", area: "Elétrica", source: "NBR 5410 Tab. 36/37 — temperatura ambiente 30 °C (solo 20 °C no método D), sem agrupamento. Alumínio aproximado (0,78 × cobre). [CONFIRMAR NA NORMA]", body: <IzTable /> },
  {
    id: "resistencia", title: "Resistência dos condutores (Ω/km)", area: "Elétrica", source: "IEC 60228 a 20 °C; na temperatura de operação R = R20·[1 + α(θ − 20)]",
    body: <Table head={["Seção (mm²)", "Cobre 20 °C", "Cobre 70 °C", "Cobre 90 °C", "Alumínio 20 °C"]}
      rows={SECOES_IZ.map((s) => [br(s, s < 10 ? 1 : 0), ...[["cu", 20], ["cu", 70], ["cu", 90], ["al", 20]].map(([m, t]) => { const r = resistenciaCondutor(m as "cu" | "al", s, t as number); return r === null ? "—" : br(r, 4); })])} />,
  },
  {
    id: "k", title: "Constante k para curto-circuito (A·√s/mm²)", area: "Elétrica", source: "NBR 5410 Tab. 30 — condutores até 300 mm²: Smín = Icc·√t/k",
    body: <Table head={["Condutor", "PVC", "EPR / XLPE"]} rows={[["Cobre", K_ADIABATICO.cu.pvc, K_ADIABATICO.cu.xlpe], ["Alumínio", K_ADIABATICO.al.pvc, K_ADIABATICO.al.xlpe]]} />,
  },
  {
    id: "comerciais", title: "Valores comerciais usados nos cálculos", area: "Elétrica", source: "Correntes nominais de disjuntores e potências de bancos de capacitores",
    body: <Table numFrom={99} head={["Item", "Valores"]} rows={[["Disjuntores In (A)", DISJUNTORES_IN.join(" · ")], ["Bancos de capacitores (kvar)", BANCOS_KVAR.map((k) => br(k, k % 1 ? 1 : 0)).join(" · ")]]} />,
  },
  {
    id: "roscas", title: "Roscas métricas grossas e pré-carga", area: "Mecânica", source: "ISO 261 (passo) · ISO 898-1 (At e Sp). Pré-carga Fi = 0,75·At·Sp",
    body: <Table head={["Rosca", "Passo (mm)", "At (mm²)", "Fi 8.8 (kN)", "Fi 10.9 (kN)", "Fi 12.9 (kN)"]}
      rows={Object.entries(ROSCAS).map(([k, r]: [string, any]) => [k, br(r.p), br(r.At, 1), ...["8.8", "10.9", "12.9"].map((c) => br((0.75 * r.At * propriedadesClasse(c, r.d).Sp) / 1000, 1))])} />,
  },
  {
    id: "modulos", title: "Módulos normalizados de engrenagens (mm)", area: "Mecânica", source: "ISO 54 — prefira a série I",
    body: <Table numFrom={99} head={["Série", "Módulos"]} rows={[["I (preferencial)", MODULOS_I.map((m: number) => br(m, m % 1 ? 2 : 0)).join(" · ")], ["II", MODULOS_II.map((m: number) => br(m, 3).replace(/0+$/, "")).join(" · ")]]} />,
  },
  {
    id: "acos", title: "Aços para eixos (valores típicos)", area: "Mecânica", source: "Shigley Tab. A-20/A-21 — confirme no certificado do material",
    body: <Table head={["Aço", "Sut (MPa)", "Sy (MPa)"]} rows={Object.values(MATERIAIS_EIXO).map((m: any) => [m.label, m.Sut, m.Sy])} />,
  },
];

export function TablesView() {
  const [q, setQ] = React.useState("");
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const list = SECOES.filter((s) => !q.trim() || norm(`${s.title} ${s.area} ${s.source}`).includes(norm(q.trim())));
  return <section className="sheet">
    <div className="sheet-head"><span className="sheet-code">TAB</span><span className="sheet-title">Tabelas de consulta</span><span className="sheet-count">{SECOES.length} tabelas · mesmos dados dos cálculos</span></div>
    <div className="tbl-search"><input type="search" placeholder="Filtrar tabelas (ex.: barra, cabo, rosca)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar tabelas" /></div>
    <nav className="tbl-index" aria-label="Índice das tabelas">{list.map((s) => <a key={s.id} href={`#tab-${s.id}`}>{s.title.split(" — ")[0]}</a>)}</nav>
    {list.map((s) => <div className="ws-block" id={`tab-${s.id}`} key={s.id}>
      <div className="ws-block-label">{s.area} · {s.title}</div>
      <div className="ws-block-body">{s.body}<div className="cost-note">{s.source}</div></div>
    </div>)}
    {list.length === 0 && <div className="hist-empty">Nenhuma tabela encontrada.</div>}
  </section>;
}
