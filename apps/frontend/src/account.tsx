import React from "react";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/** Cliente do Better Auth — API no mesmo domínio (/api/auth). Spec 002. */
export const authClient = createAuthClient({
  baseURL: `${window.location.origin}/api/auth`,
  plugins: [adminClient()],
});

export type SessionUser = { id: string; name: string; email: string; image?: string | null; role?: string | null };

export function useSession() {
  const { data, isPending } = authClient.useSession();
  return { user: (data?.user ?? null) as SessionUser | null, loading: isPending };
}

export const signInWithGoogle = () =>
  authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/" });

const HAD_SESSION = "engcalc_had_session";
export const signOut = () => { localStorage.removeItem(HAD_SESSION); return authClient.signOut().then(() => window.location.assign("/")); };

/* ═══════════ Expiração do acesso (spec 002 · R10–R13) ═══════════ */
export type AccessState = "loading" | "active" | "expired" | "none";
export type Access = { state: AccessState; accessExpiresAt?: number; restoreUntil?: number; restore: () => Promise<string | null> };
export const SESSION_EXPIRED_EVENT = "engcalc:session-expired";

/** Avisa o app quando a API responde 401 SESSION_EXPIRED (chamar após qualquer fetch da API). */
export function notifyIfExpired(body: { code?: string } | null | undefined) {
  if (body?.code === "SESSION_EXPIRED") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}

export function useAccess(userId: string | undefined): Access {
  const [st, setSt] = React.useState<{ state: AccessState; accessExpiresAt?: number; restoreUntil?: number; skew: number }>({ state: "loading", skew: 0 });

  const load = React.useCallback(async () => {
    try {
      const r = await fetch("/api/session/status", { credentials: "include" });
      const b = await r.json();
      const skew = b.serverNow ? Date.parse(b.serverNow) - Date.now() : 0; // relógio do servidor × do navegador
      setSt({ state: b.state, accessExpiresAt: b.accessExpiresAt ? Date.parse(b.accessExpiresAt) : undefined, restoreUntil: b.restoreUntil ? Date.parse(b.restoreUntil) : undefined, skew });
    } catch { setSt((c) => ({ ...c, state: "active" })); }
  }, []);

  React.useEffect(() => {
    if (!userId) { setSt({ state: "none", skew: 0 }); return; }
    localStorage.setItem(HAD_SESSION, "1");
    setSt((c) => ({ ...c, state: "loading" }));
    load();
  }, [userId, load]);

  // Vira para "expirado" no instante em que o acesso vence (sem precisar recarregar)
  React.useEffect(() => {
    if (st.state !== "active" || !st.accessExpiresAt) return;
    const ms = st.accessExpiresAt - (Date.now() + st.skew);
    const id = window.setTimeout(load, Math.max(ms + 500, 0));
    return () => window.clearTimeout(id);
  }, [st.state, st.accessExpiresAt, st.skew, load]);

  React.useEffect(() => {
    const on = () => load();
    window.addEventListener(SESSION_EXPIRED_EVENT, on);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, on);
  }, [load]);

  const restore = React.useCallback(async () => {
    const r = await fetch("/api/session/restore", { method: "POST", credentials: "include" });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) return b.error || "Não foi possível restaurar a sessão";
    await load();
    return null;
  }, [load]);

  return { state: st.state, accessExpiresAt: st.accessExpiresAt, restoreUntil: st.restoreUntil ? st.restoreUntil - st.skew : undefined, restore };
}

/** Havia sessão neste navegador e ela acabou (sem "Sair" explícito)? */
export function consumeHadSession() {
  const had = localStorage.getItem(HAD_SESSION) === "1";
  localStorage.removeItem(HAD_SESSION);
  return had;
}

/** Mensagens para os erros que o Better Auth devolve em ?error= após o callback do Google. */
const AUTH_ERRORS: Record<string, string> = {
  signup_disabled: "Você não possui cadastro. Solicite acesso a um administrador.",
  account_not_linked: "Não foi possível vincular sua conta Google ao cadastro. Fale com um administrador.",
  unable_to_link_account: "Não foi possível vincular sua conta Google ao cadastro. Fale com um administrador.",
  banned: "Seu acesso foi desativado por um administrador.",
  access_denied: "Login cancelado.",
};

export function useAuthError(): [string | null, () => void] {
  const [msg, setMsg] = React.useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get("error");
    if (!code) return null;
    return AUTH_ERRORS[code] ?? (/ban/i.test(code) ? AUTH_ERRORS.banned! : "Não foi possível entrar. Tente novamente.");
  });
  React.useEffect(() => {
    if (msg) window.history.replaceState(null, "", window.location.pathname);
  }, [msg]);
  return [msg, () => setMsg(null)];
}

/* ═══════════ Área de administração (história 5) ═══════════ */
type AdminUser = { id: string; name: string; email: string; role?: string | null; banned?: boolean | null; createdAt: string | Date };

export function AdminPanel({ me }: { me: SessionUser }) {
  const [users, setUsers] = React.useState<AdminUser[]>([]);
  const [linked, setLinked] = React.useState<Set<string>>(new Set());
  const [form, setForm] = React.useState({ name: "", email: "", role: "user" });
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await authClient.admin.listUsers({ query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" } });
    if (res.error) { setMsg({ ok: false, text: res.error.message || "Erro ao listar usuários" }); return; }
    setUsers((res.data?.users ?? []) as AdminUser[]);
    const l = await fetch("/api/admin/linked", { credentials: "include" });
    if (l.ok) setLinked(new Set(await l.json()));
  }, []);
  React.useEffect(() => { load(); }, [load]);

  const act = async (fn: () => Promise<{ error?: { message?: string } | null }>, ok: string) => {
    setBusy(true); setMsg(null);
    const res = await fn();
    setBusy(false);
    if (res.error) setMsg({ ok: false, text: res.error.message || "Erro" });
    else { setMsg({ ok: true, text: ok }); await load(); }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setMsg({ ok: false, text: "E-mail inválido" });
    if (!form.name.trim()) return setMsg({ ok: false, text: "Informe o nome" });
    act(() => authClient.admin.createUser({ name: form.name.trim(), email, role: form.role as "user" | "admin" }),
      `Usuário ${email} cadastrado — ele já pode entrar com o Google`).then(() => setForm({ name: "", email: "", role: "user" }));
  };

  return <section className="sheet admin">
    <div className="sheet-head"><span className="sheet-code">ADM</span><span className="sheet-title">Administração</span><span className="sheet-count">{users.length} usuário(s)</span></div>
    <form className="admin-form" onSubmit={create}>
      <div className="ws-block-label">Cadastrar usuário (acesso por convite)</div>
      <div className="admin-form-grid">
        <input placeholder="Nome" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="E-mail do Google que a pessoa vai usar" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="user">Usuário</option><option value="admin">Administrador</option></select>
        <button className="btn-calc" disabled={busy}>+ Cadastrar</button>
      </div>
      {msg && <div className={msg.ok ? "admin-ok" : "report-err"}>{msg.ok ? "✓" : "⚠"} {msg.text}</div>}
    </form>
    {users.map((u) => {
      const self = u.id === me.id;
      return <div className="admin-row" key={u.id}>
        <span className="calc-info"><span className="hist-name">{u.name}{self ? " (você)" : ""}</span><span className="hist-sub">{u.email}</span></span>
        <span className="admin-tags">
          <span className={`admin-tag ${u.role === "admin" ? "is-admin" : ""}`}>{u.role === "admin" ? "admin" : "usuário"}</span>
          <span className={`admin-tag ${linked.has(u.id) ? "is-ok" : ""}`}>{linked.has(u.id) ? "Google vinculado" : "aguardando 1º login"}</span>
          {u.banned && <span className="admin-tag is-alert">desativado</span>}
        </span>
        {!self && <span className="admin-actions">
          <button disabled={busy} onClick={() => act(() => authClient.admin.setRole({ userId: u.id, role: u.role === "admin" ? "user" : "admin" }), "Papel atualizado")}>{u.role === "admin" ? "tornar usuário" : "tornar admin"}</button>
          {u.banned
            ? <button disabled={busy} onClick={() => act(() => authClient.admin.unbanUser({ userId: u.id }), "Acesso reativado")}>reativar</button>
            : <button disabled={busy} onClick={() => act(() => authClient.admin.banUser({ userId: u.id, banReason: "Desativado pelo administrador" }), "Acesso desativado")}>desativar</button>}
          <button disabled={busy} className="danger" onClick={() => { if (confirm(`Remover ${u.email}? O histórico dele também será apagado.`)) act(() => authClient.admin.removeUser({ userId: u.id }), "Usuário removido"); }}>remover</button>
        </span>}
      </div>;
    })}
  </section>;
}

/* ═══════════ Histórico na nuvem (história 6) ═══════════ */
export type CloudEntry = { areaKey: string; calcId: string; calcName: string; inputSummary: string; resultStr: string; vals: Record<string, string> };

export const cloudHistory = {
  async list(): Promise<CloudEntry[]> {
    const r = await fetch("/api/history", { credentials: "include" });
    if (!r.ok) return [];
    return (await r.json()) as CloudEntry[];
  },
  async save(entries: CloudEntry[]) {
    if (!entries.length) return;
    await fetch("/api/history", { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ entries }) });
  },
  async clear() {
    await fetch("/api/history", { method: "DELETE", credentials: "include" });
  },
};
