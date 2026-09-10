import React from "react";
import { createRoot } from "react-dom/client";
import { DATA, ICONS, CABLE_CATALOG } from "@engcalc/core";
import "./styles.css";

type AreaKey = keyof typeof DATA;
type HistoryEntry = { areaKey: string; calcId: string; area: string; calcName: string; inputSummary: string; resultStr: string; vals: Record<string, string> };
const pad2 = (n: number) => String(n + 1).padStart(2, "0");
const icon = (key: string) => ({ __html: (ICONS as Record<string, string>)[key] || ICONS.tool });

function loadHistory(): HistoryEntry[] { try { const value = JSON.parse(localStorage.getItem("engcalc_history") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }

function App() {
  const [areaKey, setAreaKey] = React.useState<AreaKey>(Object.keys(DATA)[0] as AreaKey);
  const [calcId, setCalcId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState(loadHistory);
  const [showHistory, setShowHistory] = React.useState(false);
  const [sidebar, setSidebar] = React.useState(false);
  const [theme, setTheme] = React.useState<"light" | "dark">(() => localStorage.getItem("engcalc_theme") === "dark" ? "dark" : "light");
  React.useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("engcalc_theme", theme); }, [theme]);
  const area = DATA[areaKey] as any; const calc = area.calcs.find((item: any) => item.id === calcId);
  const saveHistory = (entry: HistoryEntry) => { const next = [entry, ...history].slice(0, 8); setHistory(next); localStorage.setItem("engcalc_history", JSON.stringify(next)); };
  return <>
    <header className="titleblock"><div className="tb-inner"><div className="tb-brand"><div className="tb-mark"><svg width="22" height="22" viewBox="0 0 28 28"><polygon points="14,2 25,8 25,20 14,26 3,20 3,8" stroke="#1f5fbf" strokeWidth="1.5" fill="none"/><path d="M10 9v10h8M10 14h6" stroke="currentColor" strokeWidth="1.8" fill="none"/></svg></div><div><div className="tb-name">Eng<b>Calc</b></div><div className="tb-tagline">memória de cálculo técnica</div></div></div><nav className="tb-tabs" id="area-tabs" aria-label="Disciplinas">{Object.entries(DATA).map(([key, item]: any) => <button className={`tb-tab ${!showHistory && key === areaKey ? "active" : ""}`} key={key} onClick={() => { setAreaKey(key as AreaKey); setCalcId(null); setShowHistory(false); }}><span dangerouslySetInnerHTML={icon(item.icon)} />{item.label}</button>)}</nav><div className="tb-meta"><span>REV <b>3.0</b></span><span>ESC <b>1:1</b></span></div><button className="tb-menu-btn" aria-label="Abrir menu" aria-expanded={sidebar} onClick={() => setSidebar(true)}>☰</button></div></header>
    <main className="wrap">{!showHistory ? <><section className="sheet" id="index-sheet"><div className="sheet-head"><span className="sheet-code">{area.label.slice(0, 3).toUpperCase()}</span><span className="sheet-title">{area.label}</span><span className="sheet-count">{area.calcs.length} cálculos · selecione um item</span></div>{area.calcs.map((item: any, index: number) => <button className={`calc-item ${item.id === calcId ? "active" : ""}`} key={item.id} onClick={() => setCalcId(item.id)}><span className="calc-num">{pad2(index)}</span><span className="calc-info"><span className="calc-name">{item.name}</span><span className="calc-desc">{item.desc}</span></span>{item.norma ? <span className="norma-stamp">{item.norma}</span> : <span className="calc-index-arrow">→</span>}</button>)}</section><section id="worksheet">{calc && <Worksheet key={`${areaKey}-${calc.id}`} calc={calc} areaKey={String(areaKey)} onSaved={saveHistory} />}</section></> : <History history={history} onClear={() => { setHistory([]); localStorage.removeItem("engcalc_history"); }} onOpen={entry => { setAreaKey(entry.areaKey as AreaKey); setCalcId(entry.calcId); setShowHistory(false); }} />}</main>
    <footer className="carimbo"><div className="carimbo-grid"><div className="cr-cell"><div className="cr-k">Projeto</div><div className="cr-v">EngCalc</div></div><div className="cr-cell"><div className="cr-k">Revisão</div><div className="cr-v">3.0 · 2026</div></div><div className="cr-cell"><div className="cr-k">Folha</div><div className="cr-v">01 / 01</div></div><div className="cr-cell cr-wide"><div className="cr-k">Observações</div><div className="cr-disc">Resultados para fins técnicos e educacionais. Confirme sempre com as normas vigentes (ABNT, NBR, ISO) e com responsável técnico habilitado.</div></div></div></footer>
    {sidebar && <><div className="sidebar-overlay open" onClick={() => setSidebar(false)} /><aside className="sidebar open" aria-hidden="false"><div className="sidebar-head"><span className="sidebar-code">MENU</span><span className="sidebar-title">Navegação</span><button className="sidebar-close" onClick={() => setSidebar(false)}>×</button></div><nav className="sidebar-nav"><button className="sidebar-item" onClick={() => { setShowHistory(true); setSidebar(false); }}>◷ <span>Histórico</span></button></nav><div className="sidebar-section"><div className="sidebar-section-label">Configurações</div><div className="sidebar-row"><span className="sidebar-row-label">Aparência</span><div className="theme-switch"><button className="theme-opt" aria-pressed={theme === "light"} onClick={() => setTheme("light")}>☼ Claro</button><button className="theme-opt" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}>◐ Escuro</button></div></div></div></aside></>}
  </>;
}

function CableCatalog() {
  return <Block label="Modelos de cabos cadastrados"><div className="cable-catalog">{CABLE_CATALOG.map((cable: any) => <div className="cable-card" key={cable.id}><div className="cable-card-title">{cable.fabricante} · {cable.modelo}</div><div className="cable-card-data">{cable.material} · {cable.isolacao} · {cable.tensao}</div><div className="cable-card-data">Seção: {cable.secao} mm² · Condutor: {cable.diametroCondutor ? `${cable.diametroCondutor} mm` : "não informado"} · Externo: {cable.diametroExterno ? `${cable.diametroExterno} mm` : "não informado"}</div><div className="cable-card-source">Fonte: {cable.fonte.startsWith("http") ? "catálogo do fabricante" : cable.fonte}</div></div>)}</div></Block>;
}

function Worksheet({ calc, areaKey, onSaved }: { calc: any; areaKey: string; onSaved: (entry: HistoryEntry) => void }) {
  const [values, setValues] = React.useState<Record<string, string>>({}); const [result, setResult] = React.useState<any>(null);
  const selected = (id: string) => values[id] ?? calc.fields.find((field: any) => field.id === id)?.options?.[0]?.value ?? "";
  const visible = (field: any) => !field.dependsOn || field.dependsOn.in.includes(selected(field.dependsOn.id));
  const update = (id: string, value: string) => setValues(current => ({ ...current, [id]: value }));
  const run = async () => {
    try {
      const parsed: Record<string, number | string> = {};
      for (const field of calc.fields) parsed[field.id] = field.type === "select" ? selected(field.id) : Number(values[field.id]);
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/calculations/${areaKey}/${calc.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Erro no cálculo");
      setResult(body.result);
      onSaved({ areaKey, calcId: calc.id, area: areaKey, calcName: calc.name, inputSummary: calc.fields.map((f: any) => `${f.hint || f.id}=${parsed[f.id]}`).join(", "), resultStr: body.result.value.split("\n").find((line: string) => line.trim() && !line.startsWith("──"))?.trim().slice(0, 40) || body.result.value.slice(0, 40), vals: values });
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Erro no cálculo" });
    }
  };
  return <div className="sheet ws"><div className="ws-head"><span className="ws-code">{areaKey.slice(0, 3).toUpperCase()}·01</span><span className="ws-title">{calc.name}</span>{calc.norma && <span className="norma-stamp">{calc.norma}</span>}</div>{calc.context && <Block label="Nota técnica"><p className="ws-note">{calc.context}</p></Block>}{calc.diagram && <Block label="Esquema"><div className="ws-diagram" dangerouslySetInnerHTML={{ __html: calc.diagram }} /></Block>}{calc.id === "cabo_bt" && <CableCatalog />}<Block label="Dados de entrada"><div>{calc.fields.map((field: any) => <div className="field-row" key={field.id} style={{ display: visible(field) ? "" : "none" }}><label className="field-label" htmlFor={`in-${field.id}`}>{field.label}</label><div className="field-input-wrap">{field.type === "select" ? <select id={`in-${field.id}`} value={selected(field.id)} onChange={event => update(field.id, event.target.value)}>{field.options.map((option: any) => <option value={option.value} key={option.value}>{option.label}</option>)}</select> : <input id={`in-${field.id}`} type="number" step="any" inputMode="decimal" placeholder={field.ph} value={values[field.id] ?? ""} onChange={event => update(field.id, event.target.value)} onKeyDown={event => { if (event.key === "Enter") run(); }} />}<span className="field-unit">{field.hint}</span></div></div>)}</div></Block><Block label="Fórmula"><div className="ws-formula">{calc.formula}</div></Block><div className="ws-actions"><button className="btn-calc" onClick={run}>✓ Calcular</button></div>{result && <div className="result">{result.error ? <div className="report-err">⚠ {result.error}</div> : result.multi ? <><Report value={result.value} /><button className="btn-copy-report" onClick={() => navigator.clipboard?.writeText(result.value)}>copiar relatório</button></> : <div className="result-single"><span className="result-tag">{calc.result}</span><span className="result-value">{result.value}</span><span className="result-unit">{result.unit}</span><button className="result-copy" onClick={() => navigator.clipboard?.writeText(`${result.value} ${result.unit || ""}`)}>⧉</button></div>}</div>}</div>;
}

function Report({ value }: { value: string }) {
  const lines = value.split("\n");
  return <div className="report">{lines.map((line, index) => {
    const trimmed = line.trim();
    const section = trimmed.charCodeAt(0) === 9472;
    const status = /[✓✗⚠]/u.test(trimmed);
    return <div className={`report-line${section ? " report-section" : ""}${status ? " report-status" : ""}`} key={`${index}-${line}`}>{line || "\u00a0"}</div>;
  })}</div>;
}

function Block({ label, children }: { label: string; children: React.ReactNode }) { return <div className="ws-block"><div className="ws-block-label">{label}</div><div className="ws-block-body">{children}</div></div>; }
function History({ history, onClear, onOpen }: { history: HistoryEntry[]; onClear: () => void; onOpen: (entry: HistoryEntry) => void }) { return <section id="history"><div className="sheet"><div className="sheet-head"><span className="sheet-code">LOG</span><span className="sheet-title">Histórico</span><span className="sheet-count">{history.length} registro(s)</span></div>{history.length ? history.map((entry, index) => <button className="hist-item" key={`${entry.calcId}-${index}`} onClick={() => onOpen(entry)}><span className="hist-num">{pad2(index)}</span><span className="calc-info"><span className="hist-name">{entry.calcName}</span><span className="hist-sub">{entry.area} · {entry.inputSummary}</span></span><span className="hist-res">{entry.resultStr}</span></button>) : <div className="hist-empty">Nenhum cálculo no histórico ainda.<br />Os cálculos que você realizar aparecem aqui.</div>}{history.length > 0 && <button className="hist-clear" onClick={onClear}>limpar histórico</button>}</div></section>; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
