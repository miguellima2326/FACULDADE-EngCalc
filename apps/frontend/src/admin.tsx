import React from "react";
import { AdminPanel, notifyIfExpired, type SessionUser } from "./account.js";

/* ═══════════ Spec 011 — Administração: usuários, uso e atividades ═══════════ */

type Stats = {
  totals: { d7: number; d30: number; total: number; ativos30: number };
  perUser: Array<{ name: string; email: string; n: number; ultimo: string | null }>;
  top: Array<{ areaKey: string; calcId: string; calcName: string; n: number }>;
  perDay: Array<{ dia: string; n: number }>;
};
type Audit = { id: number; actorEmail: string; action: string; targetEmail: string | null; details: Record<string, string>; createdAt: string };

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: "include" });
  const b = await r.json().catch(() => ({}));
  notifyIfExpired(b);
  if (!r.ok) throw new Error(b.error || "Erro");
  return b as T;
}
const when = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

function Usage() {
  const [s, setS] = React.useState<Stats | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { get<Stats>("/api/admin/stats").then(setS).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="report-err">⚠ {err}</div>;
  if (!s) return <div className="hist-empty">Carregando…</div>;
  const max = Math.max(1, ...s.perDay.map((d) => d.n));
  const topMax = Math.max(1, ...s.top.map((t) => t.n));
  return <div className="usage">
    <div className="kpis">
      {[["Últimos 7 dias", s.totals.d7], ["Últimos 30 dias", s.totals.d30], ["Usuários ativos (30 d)", s.totals.ativos30], ["Total registrado", s.totals.total]].map(([k, v]) =>
        <div className="kpi" key={k as string}><span>{k}</span><b>{v}</b></div>)}
    </div>
    <div className="ws-block-label">Cálculos por dia (14 dias)</div>
    <div className="bars" role="img" aria-label={`Cálculos por dia: ${s.perDay.map((d) => `${d.dia.slice(8)}/${d.dia.slice(5, 7)} ${d.n}`).join(", ")}`}>
      {s.perDay.map((d) => <div className="bar" key={d.dia} title={`${d.dia.split("-").reverse().join("/")}: ${d.n}`}>
        <span className="bar-n">{d.n || ""}</span>
        <span className="bar-fill" style={{ height: `${(d.n / max) * 100}%` }} />
        <span className="bar-d">{d.dia.slice(8)}</span>
      </div>)}
    </div>
    <div className="ws-block-label">Cálculos mais usados (30 dias)</div>
    {s.top.length === 0 && <div className="hist-empty">Sem uso registrado ainda.</div>}
    <div className="toplist">{s.top.map((t, i) => <div className="top-row" key={`${t.areaKey}-${t.calcId}`}>
      <span className="hist-num">{String(i + 1).padStart(2, "0")}</span>
      <span className="top-name">{t.calcName}<span className="hist-sub"> · {t.areaKey}</span></span>
      <span className="top-bar"><span style={{ width: `${(t.n / topMax) * 100}%` }} /></span>
      <span className="top-n">{t.n}</span>
    </div>)}</div>
    <div className="ws-block-label">Uso por usuário (30 dias)</div>
    <table className="utable"><thead><tr><th>Usuário</th><th>Cálculos</th><th>Último</th></tr></thead>
      <tbody>{s.perUser.map((u) => <tr key={u.email}><td><b>{u.name}</b><span className="hist-sub">{u.email}</span></td><td className="pd-num">{u.n}</td><td className="hist-sub">{u.ultimo ? when(u.ultimo) : "—"}</td></tr>)}</tbody>
    </table>
  </div>;
}

function Activity() {
  const [rows, setRows] = React.useState<Audit[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { get<Audit[]>("/api/admin/audit").then(setRows).catch((e) => setErr(e.message)); }, []);
  if (err) return <div className="report-err">⚠ {err}</div>;
  if (!rows) return <div className="hist-empty">Carregando…</div>;
  if (!rows.length) return <div className="hist-empty">Nenhuma atividade registrada ainda.<br />Cadastros, mudanças de papel, desativações e remoções aparecem aqui.</div>;
  return <div className="audit">{rows.map((r) => <div className="audit-row" key={r.id}>
    <span className="audit-when">{when(r.createdAt)}</span>
    <span className="audit-what"><b>{r.actorEmail}</b> {r.action}{r.targetEmail ? <> <b>{r.targetEmail}</b></> : null}{r.details?.role ? ` → ${r.details.role}` : ""}{r.details?.motivo ? ` (${r.details.motivo})` : ""}</span>
  </div>)}</div>;
}

export function AdminArea({ me }: { me: SessionUser }) {
  const [tab, setTab] = React.useState<"users" | "usage" | "audit">("users");
  return <div>
    <div className="tabs" role="tablist" aria-label="Administração">
      {([["users", "Usuários"], ["usage", "Uso"], ["audit", "Atividades"]] as const).map(([k, l]) =>
        <button key={k} role="tab" aria-selected={tab === k} className={`tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
    </div>
    {tab === "users" ? <AdminPanel me={me} />
      : <section className="sheet"><div className="sheet-head"><span className="sheet-code">ADM</span><span className="sheet-title">{tab === "usage" ? "Painel de uso" : "Registro de atividades"}</span></div>
          <div className="ws-block-body">{tab === "usage" ? <Usage /> : <Activity />}</div></section>}
  </div>;
}
