import React from "react";
import { notifyIfExpired } from "./account.js";
import { PrintCover, PrintSection, PrintDisclaimer, type SavedRun, type PrintItem } from "./worksheet.js";

/* ═══════════ Spec 007 — Projetos (obras) ═══════════ */

export type ProjectSummary = { id: number; name: string; client: string; description: string; shareToken: string | null; updatedAt: string; itemCount: number };
export type ProjectItem = { id: number; areaKey: string; calcId: string; calcName: string; vals: Record<string, string>; inputs: PrintItem["inputs"]; report: string; createdAt: string };
export type Project = Omit<ProjectSummary, "itemCount"> & { ownerName: string; readOnly: boolean; items: ProjectItem[] };
export type ProjView = { kind: "list" } | { kind: "detail"; id: number } | { kind: "shared"; token: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path, { credentials: "include", ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  if (r.status === 204) return undefined as T;
  const b = await r.json().catch(() => ({}));
  notifyIfExpired(b);
  if (!r.ok) throw new Error(b.error || "Erro");
  return b as T;
}
export const projectsApi = {
  list: () => api<ProjectSummary[]>("/api/projects"),
  create: (p: { name: string; client?: string; description?: string }) => api<{ id: number }>("/api/projects", { method: "POST", body: JSON.stringify(p) }),
  get: (id: number) => api<Project>(`/api/projects/${id}`),
  shared: (token: string) => api<Project>(`/api/shared/${token}`),
  update: (id: number, p: { name: string; client: string; description: string }) => api(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  remove: (id: number) => api(`/api/projects/${id}`, { method: "DELETE" }),
  addItem: (id: number, run: SavedRun) => api(`/api/projects/${id}/items`, { method: "POST", body: JSON.stringify(run) }),
  removeItem: (id: number, itemId: number) => api(`/api/projects/${id}/items/${itemId}`, { method: "DELETE" }),
  share: (id: number) => api<{ shareToken: string }>(`/api/projects/${id}/share`, { method: "POST" }),
  unshare: (id: number) => api(`/api/projects/${id}/share`, { method: "DELETE" }),
};

const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const shareUrl = (token: string) => `${window.location.origin}/?projeto=${token}`;

export function ProjectsList({ onOpen }: { onOpen: (id: number) => void }) {
  const [items, setItems] = React.useState<ProjectSummary[] | null>(null);
  const [form, setForm] = React.useState({ name: "", client: "", description: "" });
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { projectsApi.list().then(setItems).catch((e) => setErr(e.message)); }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    try { const { id } = await projectsApi.create(form); onOpen(id); } catch (e2) { setErr((e2 as Error).message); }
  };
  return <section className="sheet">
    <div className="sheet-head"><span className="sheet-code">PRJ</span><span className="sheet-title">Projetos</span><span className="sheet-count">{items?.length ?? "…"} projeto(s)</span></div>
    <form className="admin-form" onSubmit={create}>
      <div className="ws-block-label">Novo projeto</div>
      <div className="admin-form-grid proj-form-grid">
        <input placeholder="Nome do projeto (ex.: Galpão X)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Cliente / obra (opcional)" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
        <button className="btn-calc">+ Criar</button>
      </div>
      {err && <div className="report-err">⚠ {err}</div>}
    </form>
    {items?.length === 0 && <div className="hist-empty">Nenhum projeto ainda.<br />Crie um e use "salvar no projeto" no resultado de qualquer cálculo.</div>}
    {items?.map((p, i) => <button key={p.id} className="hist-item" onClick={() => onOpen(p.id)}>
      <span className="hist-num">{String(i + 1).padStart(2, "0")}</span>
      <span className="calc-info"><span className="hist-name">{p.name}</span><span className="hist-sub">{p.client || "sem cliente"} · atualizado {fmtDate(p.updatedAt)}{p.shareToken ? " · compartilhado" : ""}</span></span>
      <span className="hist-res">{p.itemCount} item(ns)</span>
    </button>)}
  </section>;
}

export function ProjectDetail({ view, responsible, onBack, onOpenItem }: {
  view: Extract<ProjView, { kind: "detail" | "shared" }>; responsible: string;
  onBack: () => void; onOpenItem: (item: ProjectItem, projectName: string) => void;
}) {
  const [p, setP] = React.useState<Project | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [edit, setEdit] = React.useState(false);
  const [form, setForm] = React.useState({ name: "", client: "", description: "" });
  const [copied, setCopied] = React.useState(false);
  const load = React.useCallback(() => {
    (view.kind === "detail" ? projectsApi.get(view.id) : projectsApi.shared(view.token))
      .then((d) => { setP(d); setForm({ name: d.name, client: d.client, description: d.description }); })
      .catch((e) => setErr(e.message));
  }, [view]);
  React.useEffect(load, [load]);

  if (err) return <section className="sheet"><div className="report-err">⚠ {err}</div><div className="ws-actions"><button className="btn-secondary" onClick={onBack}>← Voltar</button></div></section>;
  if (!p) return <section className="sheet"><div className="hist-empty">Carregando projeto…</div></section>;
  const ro = p.readOnly;
  const guard = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); load(); } catch (e) { setErr((e as Error).message); } };

  return <section className="sheet proj">
    <div className="sheet-head">
      <span className="sheet-code">PRJ</span><span className="sheet-title">{p.name}</span>
      <span className="sheet-count">{p.items.length} item(ns){ro ? ` · somente leitura · de ${p.ownerName}` : ""}</span>
    </div>
    <div className="proj-bar">
      <button className="ws-tool" onClick={onBack}>← projetos</button>
      <span className="proj-bar-spacer" />
      <button className="ws-tool" disabled={!p.items.length} onClick={() => window.print()}>gerar PDF do projeto</button>
      {!ro && <button className="ws-tool" onClick={() => setEdit((v) => !v)}>{edit ? "cancelar" : "editar dados"}</button>}
      {!ro && <button className="ws-tool danger" onClick={() => { if (confirm(`Excluir o projeto "${p.name}" e todos os itens?`)) guard(async () => { await projectsApi.remove(p.id); onBack(); }); }}>excluir</button>}
    </div>
    {edit && !ro
      ? <form className="admin-form" onSubmit={(e) => { e.preventDefault(); guard(async () => { await projectsApi.update(p.id, form); setEdit(false); }); }}>
          <div className="admin-form-grid proj-form-grid">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome" />
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} placeholder="Cliente / obra" />
            <button className="btn-calc">Salvar</button>
          </div>
          <textarea className="proj-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descrição" />
        </form>
      : (p.client || p.description) && <div className="ws-block-body proj-meta">{p.client && <div><b>Cliente/obra:</b> {p.client}</div>}{p.description && <p>{p.description}</p>}</div>}

    {!ro && <div className="proj-share">
      <div className="ws-block-label">Compartilhar (leitura, só usuários logados)</div>
      {p.shareToken
        ? <div className="proj-share-row">
            <input readOnly value={shareUrl(p.shareToken)} onFocus={(e) => e.currentTarget.select()} />
            <button className="ws-tool" onClick={() => { navigator.clipboard?.writeText(shareUrl(p.shareToken!)); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "copiado ✓" : "copiar"}</button>
            <button className="ws-tool danger" onClick={() => guard(() => projectsApi.unshare(p.id))}>revogar</button>
          </div>
        : <button className="ws-tool" onClick={() => guard(() => projectsApi.share(p.id))}>gerar link</button>}
    </div>}

    {p.items.length === 0 && <div className="hist-empty">Nenhum cálculo neste projeto.<br />Abra um cálculo, calcule e clique em "salvar no projeto".</div>}
    {p.items.map((it, i) => <div className="admin-row proj-item" key={it.id}>
      <span className="calc-info"><span className="hist-name">{String(i + 1).padStart(2, "0")} · {it.calcName}</span><span className="hist-sub">{it.areaKey} · {fmtDate(it.createdAt)} · {it.report.split("\n").find((l) => /[✓✗]/u.test(l))?.trim() ?? ""}</span></span>
      <span className="admin-actions">
        <button onClick={() => onOpenItem(it, p.name)}>abrir</button>
        {!ro && <button className="danger" onClick={() => { if (confirm(`Remover "${it.calcName}" do projeto?`)) guard(() => projectsApi.removeItem(p.id, it.id)); }}>remover</button>}
      </span>
    </div>)}

    {p.items.length > 0 && <div className="print-doc" aria-hidden="true">
      <PrintCover title={p.name} subtitle={[p.client, `${p.items.length} cálculo(s)`].filter(Boolean).join(" · ")} responsible={p.readOnly ? p.ownerName : responsible}
        extra={<><ol className="pd-index">{p.items.map((it) => <li key={it.id}>{it.calcName}</li>)}</ol>{p.description && <p className="pd-note">{p.description}</p>}</>} />
      {p.items.map((it, i) => <PrintSection key={it.id} index={i} item={{ title: it.calcName, areaKey: it.areaKey, inputs: it.inputs, report: it.report }} />)}
      <PrintDisclaimer />
    </div>}
  </section>;
}

/** Diálogo "salvar no projeto" — escolhe um projeto existente ou cria um novo. */
export function SaveToProjectDialog({ run, onClose, onSaved }: { run: SavedRun; onClose: () => void; onSaved: (projectName: string) => void }) {
  const [list, setList] = React.useState<ProjectSummary[] | null>(null);
  const [newName, setNewName] = React.useState("");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => { projectsApi.list().then(setList).catch((e) => setErr(e.message)); }, []);
  React.useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const save = async (id: number, name: string) => {
    setBusy(true); setErr(null);
    try { await projectsApi.addItem(id, run); onSaved(name); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const createAndSave = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newName.trim()) return;
    setBusy(true);
    try { const { id } = await projectsApi.create({ name: newName.trim() }); await save(id, newName.trim()); } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  };
  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal sheet" role="dialog" aria-modal="true" aria-label="Salvar no projeto" onClick={(e) => e.stopPropagation()}>
      <div className="sheet-head"><span className="sheet-code">PRJ</span><span className="sheet-title">Salvar no projeto</span><button className="sidebar-close modal-close" onClick={onClose} aria-label="Fechar">×</button></div>
      <div className="ws-block-body"><div className="hist-sub">{run.calcName}</div></div>
      {list === null && <div className="hist-empty">Carregando…</div>}
      {list?.map((p) => <button key={p.id} className="hist-item" disabled={busy} onClick={() => save(p.id, p.name)}>
        <span className="hist-num">→</span><span className="calc-info"><span className="hist-name">{p.name}</span><span className="hist-sub">{p.itemCount} item(ns)</span></span><span />
      </button>)}
      <form className="admin-form" onSubmit={createAndSave}>
        <div className="ws-block-label">Ou criar um novo</div>
        <div className="admin-form-grid proj-form-grid"><input autoFocus={list?.length === 0} placeholder="Nome do novo projeto" value={newName} onChange={(e) => setNewName(e.target.value)} /><button className="btn-calc" disabled={busy}>Criar e salvar</button></div>
        {err && <div className="report-err">⚠ {err}</div>}
      </form>
    </div>
  </div>;
}
