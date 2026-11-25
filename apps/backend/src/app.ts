import type { IncomingMessage, ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { calculate, DATA, CABLE_CATALOG } from "@engcalc/core";
import { getPool } from "./db.js";
import { getAuth, ACCESS_TTL_MS, RESTORE_WINDOW_MS, masterEmails } from "./auth.js";
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
  // S2: respostas da API nunca ficam em cache (dados autenticados)
  const base: Record<string, string> = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers };
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
export const MAX_BODY_BYTES = 256 * 1024; // S4
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }

export async function readJson(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers["content-length"] || 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, "Requisição muito grande");
  const pre = (request as IncomingMessage & { body?: unknown }).body;
  let raw = "";
  if (pre !== undefined && pre !== null) raw = typeof pre === "string" ? pre : JSON.stringify(pre);
  else {
    let size = 0;
    for await (const chunk of request) {
      size += (chunk as Buffer).length;
      if (size > MAX_BODY_BYTES) throw new HttpError(413, "Requisição muito grande");
      raw += chunk;
    }
  }
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw new HttpError(413, "Requisição muito grande");
  try { return raw ? JSON.parse(raw) : {}; } catch { throw new HttpError(400, "JSON inválido"); }
}

/** S3 — defesa CSRF: escritas só aceitas vindas do próprio site (Origin, ou Referer como fallback). */
function sameOrigin(request: IncomingMessage) {
  const host = (request.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim() || request.headers.host;
  const src = (request.headers.origin as string | undefined) || (request.headers.referer as string | undefined);
  if (!src || !host) return false;
  try { return new URL(src).host === host; } catch { return false; }
}
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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
/** Defesa em profundidade: usuário desativado perde todas as sessões na primeira requisição. */
async function isBanned(session: Session) {
  const u = session.user as { id: string; banned?: boolean | null; banExpires?: string | Date | null };
  const active = u.banned && (!u.banExpires || new Date(u.banExpires).getTime() > Date.now());
  if (active) await getPool().query(`delete from "session" where "userId" = $1`, [u.id]);
  return !!active;
}

/** Prazo do acesso (R10). Sessões antigas sem o campo: createdAt + 6 h. */
function accessExpiry(session: Session) {
  const s = session.session as { accessExpiresAt?: string | Date | null; createdAt: string | Date };
  return new Date(s.accessExpiresAt ?? new Date(new Date(s.createdAt).getTime() + ACCESS_TTL_MS)).getTime();
}
async function requireUser(ctx: Ctx, role?: "admin"): Promise<Session | null> {
  const session = await sessionOf(ctx.request);
  if (!session) { json(ctx.response, 401, { error: "Faça login para continuar", code: "UNAUTHENTICATED" }); return null; }
  if (await isBanned(session)) { json(ctx.response, 403, { error: "Seu acesso foi desativado por um administrador", code: "BANNED" }); return null; }
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
  if (await isBanned(session)) return json(response, 200, { state: "none", reason: "banned" });
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
  if (await isBanned(session)) return json(response, 403, { error: "Seu acesso foi desativado por um administrador", code: "BANNED" });
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
  // S6: mantém só os 500 registros mais recentes por usuário
  await pool.query(`delete from "calc_history" where "userId" = $1 and "id" not in (select "id" from "calc_history" where "userId" = $1 order by "createdAt" desc limit 500)`, [s.user.id]);
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

route("GET", /^\/api\/admin\/masters$/, async (ctx) => {
  const s = await requireUser(ctx, "admin"); if (!s) return;
  json(ctx.response, 200, [...masterEmails()]);
});

/* ── Spec 011 — painel de uso e registro de atividades ── */
route("GET", /^\/api\/admin\/stats$/, async (ctx) => {
  const s = await requireUser(ctx, "admin"); if (!s) return;
  const pool = getPool();
  const [tot, perUser, top, perDay] = await Promise.all([
    pool.query(`select count(*) filter (where "createdAt" > now() - interval '7 days')::int as d7,
                       count(*) filter (where "createdAt" > now() - interval '30 days')::int as d30,
                       count(*)::int as total,
                       count(distinct "userId") filter (where "createdAt" > now() - interval '30 days')::int as ativos30
                  from "calc_history"`),
    pool.query(`select u."name", u."email", count(h."id")::int as n, max(h."createdAt") as ultimo
                  from "user" u left join "calc_history" h on h."userId" = u."id" and h."createdAt" > now() - interval '30 days'
                 group by u."id" order by n desc, u."name" limit 50`),
    pool.query(`select "areaKey", "calcId", max("calcName") as "calcName", count(*)::int as n
                  from "calc_history" where "createdAt" > now() - interval '30 days'
                 group by "areaKey", "calcId" order by n desc limit 10`),
    pool.query(`select to_char(d, 'YYYY-MM-DD') as dia, coalesce(c.n, 0)::int as n
                  from generate_series(current_date - 13, current_date, interval '1 day') d
                  left join (select date("createdAt") as dia, count(*) as n from "calc_history"
                              where "createdAt" > current_date - 14 group by 1) c on c.dia = d::date
                 order by d`),
  ]);
  json(ctx.response, 200, { totals: tot.rows[0], perUser: perUser.rows, top: top.rows, perDay: perDay.rows });
});

route("GET", /^\/api\/admin\/audit$/, async (ctx) => {
  const s = await requireUser(ctx, "admin"); if (!s) return;
  const { rows } = await getPool().query(
    `select "id","actorEmail","action","targetEmail","details","createdAt" from "audit_log" order by "createdAt" desc limit 200`);
  json(ctx.response, 200, rows);
});

/* ── Spec 007 — projetos (obras) ── */
type ProjIn = { name?: string; client?: string; description?: string };
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const PROJ_COLS = `p."id", p."name", p."client", p."description", p."shareToken", p."createdAt", p."updatedAt"`;

async function ownProject(ctx: Ctx, s: Session, id: string) {
  const { rows } = await getPool().query(`select ${PROJ_COLS}, p."userId" from "project" p where p."id" = $1`, [id]);
  const p = rows[0];
  if (!p) { json(ctx.response, 404, { error: "Projeto não encontrado" }); return null; }
  if (p.userId !== s.user.id) { json(ctx.response, 403, { error: "Somente o dono pode alterar este projeto" }); return null; }
  return p;
}
async function projectWithItems(where: string, param: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `select ${PROJ_COLS}, p."userId", u."name" as "ownerName" from "project" p join "user" u on u."id" = p."userId" where ${where}`, [param]);
  const p = rows[0];
  if (!p) return null;
  const items = await pool.query(
    `select "id","areaKey","calcId","calcName","vals","inputs","report","createdAt" from "project_item" where "projectId" = $1 order by "createdAt"`, [p.id]);
  return { ...p, items: items.rows };
}

route("GET", /^\/api\/projects$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  const { rows } = await getPool().query(
    `select ${PROJ_COLS}, (select count(*)::int from "project_item" i where i."projectId" = p."id") as "itemCount"
       from "project" p where p."userId" = $1 order by p."updatedAt" desc`, [s.user.id]);
  json(ctx.response, 200, rows);
});

route("POST", /^\/api\/projects$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  const b = (await ctx.body()) as ProjIn;
  const name = clean(b.name, 120);
  if (!name) return json(ctx.response, 400, { error: "Informe o nome do projeto" });
  const count = await getPool().query(`select count(*)::int as n from "project" where "userId" = $1`, [s.user.id]);
  if (count.rows[0].n >= 100) return json(ctx.response, 409, { error: "Limite de 100 projetos atingido — exclua projetos antigos" }); // S6
  const { rows } = await getPool().query(
    `insert into "project"("userId","name","client","description") values ($1,$2,$3,$4) returning "id"`,
    [s.user.id, name, clean(b.client, 120), clean(b.description, 1000)]);
  json(ctx.response, 201, { id: rows[0].id });
});

route("GET", /^\/api\/projects\/(\d+)$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  const p = await projectWithItems(`p."id" = $1`, ctx.params[0]!);
  if (!p) return json(ctx.response, 404, { error: "Projeto não encontrado" });
  if (p.userId !== s.user.id) return json(ctx.response, 403, { error: "Projeto de outro usuário — use o link compartilhado" });
  json(ctx.response, 200, { ...p, readOnly: false });
});

route("PUT", /^\/api\/projects\/(\d+)$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  const b = (await ctx.body()) as ProjIn;
  const name = clean(b.name, 120);
  if (!name) return json(ctx.response, 400, { error: "Informe o nome do projeto" });
  await getPool().query(`update "project" set "name"=$1,"client"=$2,"description"=$3,"updatedAt"=now() where "id"=$4`,
    [name, clean(b.client, 120), clean(b.description, 1000), ctx.params[0]]);
  json(ctx.response, 200, { ok: true });
});

route("DELETE", /^\/api\/projects\/(\d+)$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  await getPool().query(`delete from "project" where "id" = $1`, [ctx.params[0]]);
  json(ctx.response, 204, {});
});

route("POST", /^\/api\/projects\/(\d+)\/items$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  const b = (await ctx.body()) as { areaKey?: string; calcId?: string; calcName?: string; vals?: unknown; inputs?: unknown; report?: string };
  if (!b.areaKey || !b.calcId || !b.calcName) return json(ctx.response, 400, { error: "Item inválido" });
  const pool = getPool();
  const items = await pool.query(`select count(*)::int as n from "project_item" where "projectId" = $1`, [ctx.params[0]]);
  if (items.rows[0].n >= 300) return json(ctx.response, 409, { error: "Limite de 300 cálculos por projeto atingido" }); // S6
  const { rows } = await pool.query(
    `insert into "project_item"("projectId","areaKey","calcId","calcName","vals","inputs","report") values ($1,$2,$3,$4,$5,$6,$7) returning "id"`,
    [ctx.params[0], clean(b.areaKey, 40), clean(b.calcId, 60), clean(b.calcName, 200), JSON.stringify(b.vals ?? {}), JSON.stringify(Array.isArray(b.inputs) ? b.inputs.slice(0, 60) : []), clean(b.report, 20000)]);
  await pool.query(`update "project" set "updatedAt" = now() where "id" = $1`, [ctx.params[0]]);
  json(ctx.response, 201, { id: rows[0].id });
});

route("DELETE", /^\/api\/projects\/(\d+)\/items\/(\d+)$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  await getPool().query(`delete from "project_item" where "id" = $1 and "projectId" = $2`, [ctx.params[1], ctx.params[0]]);
  json(ctx.response, 204, {});
});

route("POST", /^\/api\/projects\/(\d+)\/share$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  const token = randomBytes(18).toString("base64url");
  await getPool().query(`update "project" set "shareToken" = $1 where "id" = $2`, [token, ctx.params[0]]);
  json(ctx.response, 200, { shareToken: token });
});

route("DELETE", /^\/api\/projects\/(\d+)\/share$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return;
  if (!(await ownProject(ctx, s, ctx.params[0]!))) return;
  await getPool().query(`update "project" set "shareToken" = null where "id" = $1`, [ctx.params[0]]);
  json(ctx.response, 204, {});
});

route("GET", /^\/api\/shared\/([A-Za-z0-9_-]{16,64})$/, async (ctx) => {
  const s = await requireUser(ctx); if (!s) return; // J5: só usuários logados
  const p = await projectWithItems(`p."shareToken" = $1`, ctx.params[0]!);
  if (!p) return json(ctx.response, 404, { error: "Link inválido ou revogado" });
  const { shareToken: _t, userId, ...rest } = p;
  json(ctx.response, 200, { ...rest, readOnly: userId !== s.user.id });
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
    json(response, 200, {
      calculationId,
      result: {
        value: result.val, unit: result.unit ?? "", multi: result.multi ?? false,
        links: result.links ?? [], steps: result.steps ?? [], materials: result.materials ?? [],
      },
    });
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
  if (WRITE_METHODS.has(request.method || "")) {
    if (!sameOrigin(request)) return json(response, 403, { error: "Origem não permitida" });
    if (Number(request.headers["content-length"] || 0) > MAX_BODY_BYTES) return json(response, 413, { error: "Requisição muito grande" });
    const hasBody = Number(request.headers["content-length"] || 0) > 0 || !!request.headers["transfer-encoding"];
    const ctype = String(request.headers["content-type"] || "");
    if (hasBody && !ctype.startsWith("application/json")) return json(response, 415, { error: "Use Content-Type: application/json" });
  }
  for (const r of routes) {
    if (r.method !== request.method) continue;
    const m = url.pathname.match(r.pattern);
    if (!m) continue;
    try {
      await r.run({ request, response, url, params: m.slice(1), body: () => readJson(request) });
    } catch (error) {
      if (error instanceof HttpError) { if (!response.headersSent) json(response, error.status, { error: error.message }); return; }
      console.error(error);
      if (!response.headersSent) json(response, 500, { error: "Erro interno" });
    }
    return;
  }
  json(response, 404, { error: "Rota não encontrada" });
};
