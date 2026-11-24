import React from "react";
import { notifyIfExpired } from "./account.js";

/* ═══════════════════════════════════════════════════════════════
   Folha de cálculo — specs 004 (PDF), 005 (UX da folha), 006 (links)
   ═══════════════════════════════════════════════════════════════ */

export type CalcLink = { label: string; area: string; calcId: string; values: Record<string, number | string> };
export type Preset = { values: Record<string, string>; origin?: string; units?: Record<string, number> };
export type SavedRun = {
  areaKey: string; calcId: string; calcName: string; inputSummary: string; resultStr: string;
  vals: Record<string, string>; report: string; inputs: Array<{ label: string; value: string; unit: string }>;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Rola até o elemento, descontando o cabeçalho fixo (sticky). */
export function scrollToEl(el: HTMLElement | null) {
  if (!el) return;
  const header = document.querySelector(".titleblock") as HTMLElement | null;
  const top = el.getBoundingClientRect().top + window.scrollY - (header?.offsetHeight ?? 0) - 12;
  window.scrollTo({ top: Math.max(top, 0), behavior: reducedMotion() ? "auto" : "smooth" });
}

const fmtNum = (n: number) => (Math.abs(n) >= 1000 || Number.isInteger(n) ? String(Number(n.toFixed(4))) : String(Number(n.toPrecision(6))));
const formulas = (f: string) => String(f || "").split(" | ").map((s) => s.trim()).filter(Boolean);
const AREA_LABEL: Record<string, string> = { mecanica: "Mecânica", civil: "Civil", eletrica: "Elétrica" };

export function Worksheet({ calc, areaKey, preset, responsible, onSaved, onOpenLink, onSaveToProject }: {
  calc: any; areaKey: string; preset?: Preset | null; responsible: string;
  onSaved: (run: SavedRun) => void;
  onOpenLink: (link: CalcLink, originName: string) => void;
  onSaveToProject?: (run: SavedRun) => void;
}) {
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const resultRef = React.useRef<HTMLDivElement>(null);
  const [values, setValues] = React.useState<Record<string, string>>(() => ({ ...(preset?.values ?? {}) }));
  const [units, setUnits] = React.useState<Record<string, number>>(() => ({ ...(preset?.units ?? {}) }));
  const [result, setResult] = React.useState<any>(null);
  const [lastRun, setLastRun] = React.useState<SavedRun | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => { scrollToEl(sheetRef.current); }, []);
  React.useEffect(() => { if (result) scrollToEl(resultRef.current); }, [result]);

  const selected = (id: string) => values[id] ?? calc.fields.find((f: any) => f.id === id)?.options?.[0]?.value ?? "";
  const visible = (field: any) => !field.dependsOn || field.dependsOn.in.includes(selected(field.dependsOn.id));
  const update = (id: string, value: string) => setValues((cur) => ({ ...cur, [id]: value }));
  const unitOf = (field: any) => field.units?.[units[field.id] ?? 0];

  const loadExample = () => {
    const ex = calc.example ?? {};
    const next: Record<string, string> = {};
    for (const f of calc.fields) if (ex[f.id] !== undefined && ex[f.id] !== null) next[f.id] = String(ex[f.id]);
    setValues(next); setUnits({}); setResult(null);
  };
  const clear = () => { setValues({}); setUnits({}); setResult(null); };

  const run = async () => {
    setBusy(true);
    try {
      const parsed: Record<string, number | string | null> = {};
      const summary: string[] = [];
      for (const field of calc.fields) {
        if (field.type === "select") { parsed[field.id] = selected(field.id); continue; }
        const raw = (values[field.id] ?? "").trim();
        if (raw === "") { parsed[field.id] = null; continue; }
        let n = Number(raw.replace(",", "."));
        const u = unitOf(field);
        if (u && u.factor !== 1 && Number.isFinite(n)) {
          const base = field.units[0].value;
          summary.push(`${field.label}: ${raw} ${u.value} = ${fmtNum(n * u.factor)} ${base}`);
          n = n * u.factor;
        }
        parsed[field.id] = n;
      }
      const apiUrl = import.meta.env.VITE_API_URL || "";
      const response = await fetch(`${apiUrl}/api/calculations/${areaKey}/${calc.id}`, {
        method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: parsed }),
      });
      const body = await response.json();
      notifyIfExpired(body);
      if (!response.ok) throw new Error(body.error || "Erro no cálculo");
      const conv = summary.length ? ["── CONVERSÃO DE UNIDADES ─────────────", ...summary].join("\n") + "\n" : "";
      const value = body.result.multi ? conv + body.result.value : body.result.value;
      setResult({ ...body.result, value, conversions: summary });
      const firstLine = String(body.result.value).split("\n").find((l: string) => l.trim() && !l.startsWith("──"))?.trim() ?? "";
      const run: SavedRun = {
        areaKey, calcId: calc.id, calcName: calc.name,
        inputSummary: calc.fields.filter(visible).map((f: any) => `${f.hint || f.id}=${parsed[f.id] ?? "—"}`).join(", "),
        resultStr: (body.result.multi ? firstLine : `${body.result.value} ${body.result.unit || ""}`).slice(0, 40),
        vals: values,
        inputs: inputRows,
        report: body.result.multi ? value : `${calc.result}: ${body.result.value} ${body.result.unit || ""}`,
      };
      setLastRun(run);
      onSaved(run);
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Erro no cálculo" });
    } finally { setBusy(false); }
  };

  const inputRows = calc.fields.filter(visible).map((f: any) => {
    const v = f.type === "select" ? f.options.find((o: any) => o.value === selected(f.id))?.label : values[f.id];
    const u = f.type === "select" ? "" : (unitOf(f)?.value ?? f.hint ?? "");
    return { label: f.label, value: v === undefined || v === "" ? "—" : String(v), unit: u };
  });

  return <div className="sheet ws" ref={sheetRef}>
    <div className="ws-head">
      <span className="ws-code">{areaKey.slice(0, 3).toUpperCase()}·01</span>
      <span className="ws-title">{calc.name}</span>
      {calc.norma && <span className="norma-stamp">{calc.norma}</span>}
    </div>
    {preset?.origin && <div className="ws-origin">↳ valores vindos de: <b>{preset.origin}</b> — confira antes de calcular</div>}
    {calc.context && <Block label="Nota técnica"><p className="ws-note">{calc.context}</p></Block>}
    {calc.diagram && <Block label="Esquema"><div className="ws-diagram" dangerouslySetInnerHTML={{ __html: calc.diagram }} /></Block>}
    <Block label="Dados de entrada" extra={<span className="ws-tools">
      {calc.example && <button type="button" onClick={loadExample}>carregar exemplo</button>}
      <button type="button" onClick={clear}>limpar</button>
    </span>}>
      <div>{calc.fields.map((field: any) => <div className="field-row" key={field.id} style={{ display: visible(field) ? "" : "none" }}>
        <label className="field-label" htmlFor={`in-${field.id}`}>{field.label}{field.optional && <span className="field-opt"> (opcional)</span>}</label>
        <div className="field-input-wrap">
          {field.type === "select"
            ? <select id={`in-${field.id}`} value={selected(field.id)} onChange={(e) => update(field.id, e.target.value)}>{field.options.map((o: any) => <option value={o.value} key={o.value}>{o.label}</option>)}</select>
            : <input id={`in-${field.id}`} type="text" inputMode="decimal" placeholder={field.ph} value={values[field.id] ?? ""} onChange={(e) => update(field.id, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") run(); }} />}
          {field.units?.length > 1
            ? <select className="field-unit-select" aria-label={`Unidade de ${field.label}`} value={units[field.id] ?? 0} onChange={(e) => setUnits((u) => ({ ...u, [field.id]: Number(e.target.value) }))}>{field.units.map((u: any, i: number) => <option key={u.value} value={i}>{u.value}</option>)}</select>
            : <span className="field-unit">{field.hint}</span>}
        </div>
      </div>)}</div>
    </Block>
    <Block label="Fórmulas"><ol className="ws-formulas">{formulas(calc.formula).map((f, i) => <li key={i}>{f}</li>)}</ol></Block>
    <div className="ws-actions"><button className="btn-calc" onClick={run} disabled={busy}>{busy ? "Calculando…" : "✓ Calcular"}</button></div>
    {result && <div className="result" ref={resultRef}>
      {result.error ? <div className="report-err">⚠ {result.error}</div>
        : result.multi ? <Report value={result.value} />
        : <div className="result-single"><span className="result-tag">{calc.result}</span><span className="result-value">{result.value}</span><span className="result-unit">{result.unit}</span></div>}
      {!result.error && <div className="result-actions">
        <button className="btn-copy-report" onClick={() => navigator.clipboard?.writeText(result.multi ? result.value : `${result.value} ${result.unit || ""}`)}>copiar</button>
        <button className="btn-copy-report" onClick={() => window.print()}>gerar PDF</button>
        {onSaveToProject && lastRun && <button className="btn-copy-report" onClick={() => onSaveToProject(lastRun)}>salvar no projeto</button>}
      </div>}
      {!result.error && result.links?.length > 0 && <div className="result-links">
        <div className="ws-block-label">Próximo passo</div>
        {result.links.map((l: CalcLink, i: number) => <button key={i} className="btn-link" onClick={() => onOpenLink(l, calc.name)}>→ {l.label}</button>)}
      </div>}
    </div>}
    {result && !result.error && <PrintDoc calc={calc} areaKey={areaKey} inputs={inputRows} report={result.multi ? result.value : `${calc.result}: ${result.value} ${result.unit || ""}`} responsible={responsible} />}
  </div>;
}

/* ─── Memória de cálculo para impressão / PDF (spec 004) ─── */
export type PrintItem = { title: string; areaKey: string; norma?: string; context?: string; formula?: string; inputs: Array<{ label: string; value: string; unit: string }>; report: string };

export function PrintSection({ item, index }: { item: PrintItem; index?: number }) {
  return <section className="pd-section">
    <h2>{index !== undefined ? `${index + 1}. ` : ""}{item.title}</h2>
    <div className="pd-meta">{AREA_LABEL[item.areaKey] ?? item.areaKey}{item.norma ? ` · ${item.norma}` : ""}</div>
    {item.context && <p className="pd-note">{item.context}</p>}
    <h3>Dados de entrada</h3>
    <table className="pd-table"><tbody>{item.inputs.map((r, i) => <tr key={i}><td>{r.label}</td><td className="pd-num">{r.value}</td><td>{r.unit}</td></tr>)}</tbody></table>
    {item.formula && <><h3>Fórmulas</h3><ol className="pd-formulas">{formulas(item.formula).map((f, i) => <li key={i}>{f}</li>)}</ol></>}
    <h3>Resultados</h3>
    <pre className="pd-report">{item.report}</pre>
  </section>;
}

export function PrintCover({ title, subtitle, responsible, extra }: { title: string; subtitle?: string; responsible: string; extra?: React.ReactNode }) {
  const now = new Date();
  return <header className="pd-cover">
    <div className="pd-brand">Eng<b>Calc</b> <span>memória de cálculo técnica</span></div>
    <h1>{title}</h1>
    {subtitle && <div className="pd-sub">{subtitle}</div>}
    <table className="pd-stamp"><tbody><tr>
      <td><span>Responsável</span>{responsible}</td>
      <td><span>Data</span>{now.toLocaleDateString("pt-BR")} {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
      <td><span>Revisão</span>3.0</td>
    </tr></tbody></table>
    {extra}
  </header>;
}

export const PrintDisclaimer = () => <footer className="pd-disclaimer">Resultados para fins técnicos e educacionais, gerados pelo EngCalc. Confirme sempre com as normas vigentes (ABNT/NBR, IEC, ISO) e com responsável técnico habilitado antes de utilizar em projeto ou execução.</footer>;

function PrintDoc({ calc, areaKey, inputs, report, responsible }: { calc: any; areaKey: string; inputs: PrintItem["inputs"]; report: string; responsible: string }) {
  return <div className="print-doc" aria-hidden="true">
    <PrintCover title={calc.name} subtitle={`${AREA_LABEL[areaKey] ?? areaKey}${calc.norma ? ` · ${calc.norma}` : ""}`} responsible={responsible} />
    <PrintSection item={{ title: "Memória de cálculo", areaKey, norma: calc.norma, context: calc.context, formula: calc.formula, inputs, report }} />
    <PrintDisclaimer />
  </div>;
}

export function Report({ value }: { value: string }) {
  const lines = value.split("\n");
  return <div className="report">{lines.map((line, index) => {
    const trimmed = line.trim();
    const section = trimmed.charCodeAt(0) === 9472;
    const status = /[✓✗⚠]/u.test(trimmed);
    return <div className={`report-line${section ? " report-section" : ""}${status ? " report-status" : ""}`} key={`${index}-${line}`}>{line || " "}</div>;
  })}</div>;
}

export function Block({ label, children, extra }: { label: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return <div className="ws-block"><div className="ws-block-label">{label}{extra}</div><div className="ws-block-body">{children}</div></div>;
}
