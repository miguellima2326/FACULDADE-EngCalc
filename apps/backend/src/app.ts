import type { IncomingMessage, ServerResponse } from "node:http";
import { calculate, DATA, CABLE_CATALOG } from "@engcalc/core";
import { getPool } from "./db.js";

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

route("GET", /^\/api\/catalog$/, ({ response }) => {
  const catalog = Object.entries(DATA).map(([id, area]: [string, any]) => ({
    id, label: area.label, icon: area.icon,
    calculations: area.calcs.map((item: any) => ({ ...item, calc: undefined })),
  }));
  json(response, 200, catalog);
});

route("GET", /^\/api\/cable-catalog$/, ({ response }) => json(response, 200, CABLE_CATALOG));

route("POST", /^\/api\/calculations\/([^/]+)\/([^/]+)$/, async ({ response, params, body }) => {
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
