import React from "react";
import { createRoot } from "react-dom/client";
import { DATA, ICONS } from "@engcalc/core";
import "./styles.css";
import { LoginScreen, Splash, ExpiredScreen } from "./login.js";
import { Sidebar } from "./sidebar.js";
import { ProjectsList, ProjectDetail, SaveToProjectDialog, type ProjView, type ProjectItem } from "./projects.js";
import { AdminArea } from "./admin.js";
import { Worksheet, type Preset, type CalcLink, type SavedRun } from "./worksheet.js";
import { useSession, useAuthError, useAccess, consumeHadSession, cloudHistory, type CloudEntry } from "./account.js";

type AreaKey = keyof typeof DATA;
type HistoryEntry = { areaKey: string; calcId: string; area: string; calcName: string; inputSummary: string; resultStr: string; vals: Record<string, string> };
const pad2 = (n: number) => String(n + 1).padStart(2, "0");
const icon = (key: string) => ({ __html: (ICONS as Record<string, string>)[key] || ICONS.tool });

function loadHistory(): HistoryEntry[] { try { const value = JSON.parse(localStorage.getItem("engcalc_history") || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }

const toCloud = (e: HistoryEntry): CloudEntry => ({ areaKey: e.areaKey, calcId: e.calcId, calcName: e.calcName, inputSummary: e.inputSummary, resultStr: e.resultStr, vals: e.vals });
const fromCloud = (e: CloudEntry): HistoryEntry => ({ ...e, area: e.areaKey });

function App() {
  const [areaKey, setAreaKey] = React.useState<AreaKey>(Object.keys(DATA)[0] as AreaKey);
  const [calcId, setCalcId] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState(loadHistory);
  const [showHistory, setShowHistory] = React.useState(false);
  const [showAdmin, setShowAdmin] = React.useState(false);
  // Spec 007: link compartilhado ?projeto=<token> abre o projeto (após o login)
  const [proj, setProj] = React.useState<ProjView | null>(() => { const t = new URLSearchParams(window.location.search).get("projeto"); return t ? { kind: "shared", token: t } : null; });
  const [saveRun, setSaveRun] = React.useState<SavedRun | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);
  React.useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), 3200); return () => clearTimeout(id); }, [toast]);
  const { user, loading } = useSession();
  const [authErrorRaw, clearAuthError] = useAuthError();
  const access = useAccess(user?.id);
  const [expiredNotice] = React.useState(() => !user && consumeHadSession() ? "Sua sessão expirou. Faça login novamente." : null);
  const authError = authErrorRaw ?? expiredNotice;
  const isAdmin = user?.role === "admin";
  // Histórico na nuvem: ao entrar, importa o histórico local (uma vez) e passa a ler do servidor
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      const local = loadHistory();
      if (local.length) {
        await cloudHistory.save(local.map(toCloud));
        localStorage.removeItem("engcalc_history");
      }
      setHistory((await cloudHistory.list()).map(fromCloud));
    })();
  }, [user?.id]);
  const [sidebar, setSidebar] = React.useState(false);
  const [theme, setTheme] = React.useState<"light" | "dark">(() => localStorage.getItem("engcalc_theme") === "dark" ? "dark" : "light");
  React.useEffect(() => { document.documentElement.setAttribute("data-theme", theme); localStorage.setItem("engcalc_theme", theme); }, [theme]);
  const area = DATA[areaKey] as any; const calc = area.calcs.find((item: any) => item.id === calcId);
  const saveHistory = (entry: HistoryEntry) => {
    const next = [entry, ...history].slice(0, user ? 50 : 8);
    setHistory(next);
    if (user) cloudHistory.save([toCloud(entry)]); else localStorage.setItem("engcalc_history", JSON.stringify(next));
  };
  const [preset, setPreset] = React.useState<Preset | null>(null);
  const [sheetKey, setSheetKey] = React.useState(0);
  const openCalc = (area: string, id: string, p: Preset | null = null) => {
    setAreaKey(area as AreaKey); setCalcId(id); setPreset(p); setSheetKey((k) => k + 1); go("calc");
  };
  const onOpenLink = (link: CalcLink, originName: string) =>
    openCalc(link.area, link.calcId, { values: Object.fromEntries(Object.entries(link.values).map(([k, v]) => [k, String(v)])), origin: originName });
  const onSaved = (run: SavedRun) => saveHistory({ ...run, area: run.areaKey });
  const go = (view: "calc" | "history" | "admin" | "projects") => {
    setShowHistory(view === "history"); setShowAdmin(view === "admin"); setProj(view === "projects" ? { kind: "list" } : null); setSidebar(false);
    if (window.location.search.includes("projeto=")) window.history.replaceState(null, "", "/");
  };
  const openProjectItem = (it: ProjectItem, projectName: string) => openCalc(it.areaKey, it.calcId, { values: it.vals ?? {}, origin: `Projeto ${projectName}` });
  if (loading || (user && access.state === "loading")) return <Splash />;
  if (!user || access.state === "none") return <LoginScreen error={authError} onDismissError={clearAuthError} />;
  if (access.state === "expired") return <ExpiredScreen access={access} userName={user.name} />;
  return <>
    <header className="titleblock"><div className="tb-inner"><div className="tb-brand"><div className="tb-mark"><svg width="22" height="22" viewBox="0 0 28 28"><polygon points="14,2 25,8 25,20 14,26 3,20 3,8" stroke="#1f5fbf" strokeWidth="1.5" fill="none"/><path d="M18 9h-8v10h8M10 14h6" stroke="currentColor" strokeWidth="1.8" fill="none"/></svg></div><div><div className="tb-name">Eng<b>Calc</b></div><div className="tb-tagline">memória de cálculo técnica</div></div></div><nav className="tb-tabs" id="area-tabs" aria-label="Disciplinas">{Object.entries(DATA).map(([key, item]: any) => <button className={`tb-tab ${!showHistory && !showAdmin && !proj && key === areaKey ? "active" : ""}`} key={key} onClick={() => { setAreaKey(key as AreaKey); setCalcId(null); go("calc"); }}><span dangerouslySetInnerHTML={icon(item.icon)} />{item.label}</button>)}</nav><div className="tb-meta"><span>REV <b>3.0</b></span><span>ESC <b>1:1</b></span></div><button className="tb-user" title={`${user.name} — abrir menu`} aria-label="Abrir menu" aria-expanded={sidebar} onClick={() => setSidebar(true)}>{user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1).toUpperCase()}</span>}</button></div></header>
    <main className="wrap">{proj ? (proj.kind === "list" ? <ProjectsList onOpen={(id) => setProj({ kind: "detail", id })} /> : <ProjectDetail key={JSON.stringify(proj)} view={proj} responsible={user.name} onBack={() => go("projects")} onOpenItem={openProjectItem} />) : showAdmin && isAdmin && user ? <AdminArea me={user} /> : !showHistory ? <><section className="sheet" id="index-sheet"><div className="sheet-head"><span className="sheet-code">{area.label.slice(0, 3).toUpperCase()}</span><span className="sheet-title">{area.label}</span><span className="sheet-count">{area.calcs.length} cálculos · selecione um item</span></div>{area.calcs.map((item: any, index: number) => <button className={`calc-item ${item.id === calcId ? "active" : ""}`} key={item.id} onClick={() => openCalc(String(areaKey), item.id)}><span className="calc-num">{pad2(index)}</span><span className="calc-info"><span className="calc-name">{item.name}</span><span className="calc-desc">{item.desc}</span></span>{item.norma ? <span className="norma-stamp">{item.norma}</span> : <span className="calc-index-arrow">→</span>}</button>)}</section><section id="worksheet">{calc && <Worksheet key={`${areaKey}-${calc.id}-${sheetKey}`} calc={calc} areaKey={String(areaKey)} preset={preset} responsible={user.name} onSaved={onSaved} onOpenLink={onOpenLink} onSaveToProject={setSaveRun} />}</section></> : <History history={history} onClear={() => { setHistory([]); if (user) cloudHistory.clear(); else localStorage.removeItem("engcalc_history"); }} onOpen={entry => openCalc(entry.areaKey, entry.calcId, { values: entry.vals ?? {}, origin: "Histórico" })} />}</main>
    <footer className="carimbo"><div className="carimbo-grid"><div className="cr-cell"><div className="cr-k">Projeto</div><div className="cr-v">EngCalc</div></div><div className="cr-cell"><div className="cr-k">Revisão</div><div className="cr-v">3.0 · 2026</div></div><div className="cr-cell"><div className="cr-k">Folha</div><div className="cr-v">01 / 01</div></div><div className="cr-cell cr-wide"><div className="cr-k">Observações</div><div className="cr-disc">Resultados para fins técnicos e educacionais. Confirme sempre com as normas vigentes (ABNT, NBR, ISO) e com responsável técnico habilitado.</div></div></div></footer>
    {sidebar && <Sidebar user={user} isAdmin={isAdmin} view={proj ? "projects" : showAdmin ? "admin" : showHistory ? "history" : "calc"} theme={theme} onTheme={setTheme} onGo={go} onClose={() => setSidebar(false)} />}
    {saveRun && <SaveToProjectDialog run={saveRun} onClose={() => setSaveRun(null)} onSaved={(name) => { setSaveRun(null); setToast(`✓ Salvo no projeto "${name}"`); }} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </>;
}

function History({ history, onClear, onOpen }: { history: HistoryEntry[]; onClear: () => void; onOpen: (entry: HistoryEntry) => void }) { return <section id="history"><div className="sheet"><div className="sheet-head"><span className="sheet-code">LOG</span><span className="sheet-title">Histórico</span><span className="sheet-count">{history.length} registro(s)</span></div>{history.length ? history.map((entry, index) => <button className="hist-item" key={`${entry.calcId}-${index}`} onClick={() => onOpen(entry)}><span className="hist-num">{pad2(index)}</span><span className="calc-info"><span className="hist-name">{entry.calcName}</span><span className="hist-sub">{entry.area} · {entry.inputSummary}</span></span><span className="hist-res">{entry.resultStr}</span></button>) : <div className="hist-empty">Nenhum cálculo no histórico ainda.<br />Os cálculos que você realizar aparecem aqui.</div>}{history.length > 0 && <button className="hist-clear" onClick={onClear}>limpar histórico</button>}</div></section>; }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
