import type { IncomingMessage, ServerResponse } from "node:http";
import { calculate, DATA, CABLE_CATALOG } from "@engcalc/core";
import { getPool } from "./db.js";
import { getAuth, ACCESS_TTL_MS, RESTORE_WINDOW_MS } from "./auth.js";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";

/**
 * Roteador único da API — usado tanto pelo servidor local (server.ts)
 * quanto pela função serverless da Vercel (api/index.ts na raiz).
 */

export type Handler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
type Route = { method: string; pattern: RegExp; run: (ctx: Ctx) => Promise<void> | void };
export type Ctx = { request: IncomingMessage; response: ServerResponse; url: URL; params: string[]; body: () => Promise<unknown> };

const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "";

export const json = (response: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
  const base: Record<string, string> = { "content-type": "application/json; charset=utf-8", ...headers };
  if (ALLOWED_ORIGIN) {
    base["access-control-allow-origin"] = ALLOWED_ORIGIN;
    base["access-control-allow-credentials"] = "true";
    base["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    base["access-control-allow-headers"] = "Content-Type";
  }
  response.writeHead(status, base);
  response.end(status === 204 ? undefined : JSON.stringify(body));
};

/** Lê o corpo JSON — compatível com a Vercel (que pode já ter lido o stream em req.body). */
export async function readJson(request: IncomingMessage): Promise<unknown> {
  const pre = (request as IncomingMessage & { body?: unknown }).body;
  if (pre !== undefined && pre !== null) return typeof pre === "string" ? JSON.parse(pre || "{}") : pre;
  let raw = "";
  for await (const chunk of request) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** Na Vercel, a rewrite manda /api/(.*) para /api?__path=$1 — reconstrói o caminho original. */
export function resolveUrl(request: IncomingMessage): URL {
  const url = new URL(request.url || "/", "http://localhost");
  const rewritten = url.searchParams.get("__path");
  if (rewritten !== null) {
    url.searchParams.delete("__path");
    url.pathname = `/api/${rewritten}`.replace(/\/+$/, "") || "/api";
  }
  return url;
}

const routes: Route[] = [];
export const route = (method: string, pattern: RegExp, run: Route["run"]) => routes.push({ method, pattern, run });

route("GET", /^\/api\/health$/, ({ response }) => json(response, 200, { status: "ok" }));

route("GET", /^\/api\/health\/db$/, async ({ response }) => {
  try {
    const { rows } = await getPool().query("select now() as now, current_database() as db, version() as version");
    json(response, 200, { status: "ok", database: rows[0].db, now: rows[0].now, version: String(rows[0].version).split(" on ")[0] });
  } catch (error) {
    console.error(error);
    json(response, 503, { status: "erro", error: "Banco de dados indisponível" });
  }
});

/* ── Sessão (spec 002) ── */
async function sessionOf(request: IncomingMessage) {
  return getAuth().api.getSession({ headers: fromNodeHeaders(request.headers) });
}
type Session = NonNullable<Awaited<ReturnType<typeof sessionOf>>>;
/** Prazo do acesso (R10). Sessões antigas sem o campo: createdAt + 6 h. */
function accessExpiry(session: Session) {
  const s = session.session as { accessExpiresAt?: string | Date | null; createdAt: string | Date };
  return new Date(s.accessExpiresAt ?? new Date(new Date(s.createdAt).getTime() + ACCESS_TTL_MS)).getTime();
}
async function requireUser(ctx: Ctx, role?: "admin"): Promise<Session | null> {
  const session = await sessionOf(ctx.request);
  if (!session) { json(ctx.response, 401, { error: "Faça login para continuar", code: "UNAUTHENTICATED" }); return null; }
  const exp = accessExpiry(session);
  if (Date.now() > exp) {
    json(ctx.response, 401, { error: "Login expirado — faça login novamente", code: "SESSION_EXPIRED", restoreUntil: new Date(exp + RESTORE_WINDOW_MS).toISOString() });
    return null;
  }
  if (role && (session.user as { role?: string }).role !== role) { json(ctx.response, 403, { error: "Acesso restrito a administradores" }); return null; }
  return session;
}

/* ── Expiração e restauração da sessão (R10–R12) ── */
route("GET", /^\/api\/session\/status$/, async ({ request, response }) => {
  const session = await sessionOf(request);
  if (!session) return json(response, 200, { state: "none" });
  const exp = accessExpiry(session);
  const restoreUntil = exp + RESTORE_WINDOW_MS;
  const now = Date.now();
  json(response, 200, {
    state: now <= exp ? "active" : now <= restoreUntil ? "expired" : "none",
    accessExpiresAt: new Date(exp).toISOString(),
    restoreUntil: new Date(restoreUntil).toISOString(),
    serverNow: new Date(now).toISOString(),
  });
});

route("POST", /^\/api\/session\/restore$/, async ({ request, response }) => {
  const session = await sessionOf(request);
  if (!session) return json(response, 401, { error: "Sessão encerrada — entre com o Google novamente", code: "UNAUTHENTICATED" });
  const exp = accessExpiry(session);
  const now = Date.now();
  if (now > exp + RESTORE_WINDOW_MS) return json(response, 410, { error: "A janela de 1 hora para restaurar terminou — entre com o Google novamente", code: "RESTORE_WINDOW_CLOSED" });
  const accessExpiresAt = new Date(now + ACCESS_TTL_MS), expiresAt = new Date(now + ACCESS_TTL_MS + RESTORE_WINDOW_MS);
  await getPool().query(`update "session" set "accessExpiresAt" = $1, "expiresAt" = $2, "updatedAt" = now() where "id" = $3`, [accessExpiresAt, expiresAt, session.session.id]);
  json(response, 200, { state: "active", accessExpiresAt: accessExpiresAt.toISOString(), restoreUntil: expiresAt.toISOString() });
});

/* ── Histórico na nuvem (história 6) ── */
const HIST_LIMIT = 50;
type HistIn = { areaKey: string; calcId: string; calcName: string; inputSummary?: string; resultStr?: string; vals?: Record<string, string> };
const histOk = (e: any): e is HistIn => e && typeof e.areaKey === "string" && typeof e.calcId === "string" && typeof e.calcName === "string";

route("GET", /^\/api\/history$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  const { rows } = await getPool().query(
    `select "id","areaKey","calcId","calcName","inputSummary","resultStr","vals","createdAt"
       from "calc_history" where "userId" = $1 order by "createdAt" desc limit ${HIST_LIMIT}`, [s.user.id]);
  json(ctx.response, 200, rows);
});

route("POST", /^\/api\/history$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  const body = (await ctx.body()) as { entries?: unknown[] } | HistIn;
  const entries = ("entries" in (body as object) ? (body as { entries: unknown[] }).entries : [body]).filter(histOk).slice(0, HIST_LIMIT);
  if (!entries.length) return json(ctx.response, 400, { error: "Entrada de histórico inválida" });
  const pool = getPool();
  for (const e of entries.reverse()) {
    await pool.query(
      `insert into "calc_history"("userId","areaKey","calcId","calcName","inputSummary","resultStr","vals") values ($1,$2,$3,$4,$5,$6,$7)`,
      [s.user.id, e.areaKey, e.calcId, e.calcName.slice(0, 200), (e.inputSummary || "").slice(0, 500), (e.resultStr || "").slice(0, 200), JSON.stringify(e.vals || {})]);
  }
  json(ctx.response, 201, { saved: entries.length });
});

route("DELETE", /^\/api\/history$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  await getPool().query(`delete from "calc_history" where "userId" = $1`, [s.user.id]);
  json(ctx.response, 204, {});
});

/* ── Admin: quem já vinculou o Google (história 5) ── */
route("GET", /^\/api\/admin\/linked$/, async (ctx) => {
  const s = await requireUser(ctx, "admin"); if (!s) return;
  const { rows } = await getPool().query(`select distinct "userId" from "account" where "providerId" = 'google'`);
  json(ctx.response, 200, rows.map((r) => r.userId));
});

route("GET", /^\/api\/catalog$/, async (ctx) => {
  if (!(await requireUser(ctx))) return;
  const { response } = ctx;
  const catalog = Object.entries(DATA).map(([id, area]: [string, any]) => ({
    id, label: area.label, icon: area.icon,
    calculations: area.calcs.map((item: any) => ({ ...item, calc: undefined })),
  }));
  json(response, 200, catalog);
});

route("GET", /^\/api\/cable-catalog$/, async (ctx) => {
  if (!(await requireUser(ctx))) return;
  json(ctx.response, 200, CABLE_CATALOG);
});

route("POST", /^\/api\/calculations\/([^/]+)\/([^/]+)$/, async (ctx) => {
  if (!(await requireUser(ctx))) return; // R7: todo o sistema exige login
  const { response, params, body } = ctx;
  const [areaKey, calculationId] = params as [string, string];
  const payload = (await body()) as { values?: Record<string, number | string | null> };
  if (!payload?.values) return json(response, 400, { error: "values é obrigatório" });
  try {
    const result = calculate(areaKey, calculationId, payload.values);
    json(response, 200, { calculationId, result: { value: result.val, unit: result.unit ?? "", multi: result.multi ?? false } });
  } catch (error) {
    json(response, 422, { error: error instanceof Error ? error.message : "Erro no cálculo" });
  }
});

export const handle: Handler = async (request, response) => {
  const url = resolveUrl(request);
  if (request.method === "OPTIONS") return json(response, 204, {});
  // Better Auth cuida de tudo em /api/auth/* (login Google, callback, sessão, admin)
  if (url.pathname === "/api/auth" || url.pathname.startsWith("/api/auth/")) {
    request.url = url.pathname + url.search;
    try { return await toNodeHandler(getAuth())(request, response); }
    catch (error) { console.error(error); if (!response.headersSent) return json(response, 500, { error: "Erro de autenticação" }); return; }
  }
  for (const r of routes) {
    if (r.method !== request.method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    try {
      await r.run({ request, response, url, params: m.slice(1), body: () => readJson(request) });
    } catch (error) {
      console.error(error);
      if (!response.headersSent) json(response, 500, { error: "Erro interno" });
    }
    return;
  }
  json(response, 404, { error: "Rota não encontrada" });
};
