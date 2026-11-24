import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware, getSessionFromCtx, APIError } from "better-auth/api";
import { getPool } from "./db.js";

/**
 * Autenticação — spec 002 (acesso por convite + login Google).
 *
 * - Sem e-mail/senha (R5) e sem auto-cadastro: `disableSignUp` no Google faz o login de
 *   um e-mail não cadastrado falhar com `error=signup_disabled` (R1).
 * - Vínculo automático: o admin cadastra o e-mail; no 1º login com Google o Better Auth
 *   encontra o usuário pelo e-mail e vincula a conta Google (accountLinking), desde que o
 *   Google confirme o e-mail como verificado.
 *   E-mails diferentes nunca são vinculados (allowDifferentEmails = false, padrão) (R2).
 * - Plugin admin: papéis, banir (R8) e rotas /api/auth/admin/* protegidas por papel (R9).
 */
let instance: ReturnType<typeof createAuth> | null = null;

/* ── Spec 011 — registro de atividades administrativas ── */
const AUDITED: Record<string, string> = {
  "/admin/create-user": "cadastrou usuário",
  "/admin/set-role": "alterou papel",
  "/admin/ban-user": "desativou usuário",
  "/admin/unban-user": "reativou usuário",
  "/admin/remove-user": "removeu usuário",
};
/** e-mail do alvo capturado ANTES da ação (necessário para remove-user, que apaga o registro). */
const pendingTarget = new Map<string, string>();

async function emailOf(userId: unknown) {
  if (typeof userId !== "string") return null;
  const { rows } = await getPool().query(`select "email" from "user" where "id" = $1`, [userId]);
  return (rows[0]?.email as string | undefined) ?? null;
}

const ipOf = (ctx: { request?: Request }) => ctx.request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
async function audit(actorId: string | null, actorEmail: string, action: string, targetEmail: string | null, details: Record<string, unknown>) {
  try {
    await getPool().query(
      `insert into "audit_log"("actorId","actorEmail","action","targetEmail","details") values ($1,$2,$3,$4,$5)`,
      [actorId, actorEmail, action, targetEmail, JSON.stringify(details)]);
  } catch (error) { console.error("audit_log", error); }
}
/** sessão de quem está saindo, capturada antes do /sign-out apagar a sessão */
const pendingSignOut = new WeakMap<object, { id: string; email: string }>();

const auditBefore = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-out") {
    const s = await getSessionFromCtx(ctx).catch(() => null);
    if (s && ctx.request) pendingSignOut.set(ctx.request, { id: s.user.id, email: s.user.email });
    return;
  }
  if (!AUDITED[ctx.path]) return;
  const body = (ctx.body ?? {}) as { userId?: string; role?: string };
  // Regra: admin não pode ser desativado nem removido (rebaixe para usuário antes);
  // e o sistema nunca fica sem admin (não rebaixa o último).
  if (body.userId && (ctx.path === "/admin/ban-user" || ctx.path === "/admin/remove-user" || ctx.path === "/admin/set-role")) {
    const { rows } = await getPool().query(`select "role" from "user" where "id" = $1`, [body.userId]);
    const isAdmin = rows[0]?.role === "admin";
    if (isAdmin && ctx.path !== "/admin/set-role")
      throw new APIError("FORBIDDEN", { message: "Não é possível desativar ou remover um administrador. Rebaixe-o para usuário antes." });
    if (isAdmin && ctx.path === "/admin/set-role" && body.role !== "admin") {
      const c = await getPool().query(`select count(*)::int as n from "user" where "role" = 'admin' and coalesce("banned", false) = false`);
      if (c.rows[0].n <= 1) throw new APIError("FORBIDDEN", { message: "Este é o último administrador — promova outro antes de rebaixá-lo." });
    }
  }
  const email = await emailOf(body.userId);
  if (body.userId && email) pendingTarget.set(body.userId, email);
});

const auditAfter = createAuthMiddleware(async (ctx) => {
  const ip = ipOf(ctx);
  // S7 — login (callback do Google): sucesso cria sessão; bloqueio redireciona com ?error=
  if (ctx.path === "/callback/:id") {
    const ns = ctx.context.newSession as { user?: { id: string; email: string } } | null | undefined;
    if (ns?.user) return audit(ns.user.id, ns.user.email, "entrou no sistema", null, { ip, provedor: "google" });
    const r = ctx.context.returned as { headers?: Headers | Record<string, string> } | undefined;
    const loc = r?.headers instanceof Headers ? r.headers.get("location") : (r?.headers as Record<string, string> | undefined)?.location;
    const code = loc ? new URL(loc, "http://x").searchParams.get("error") : null;
    if (code) return audit(null, "visitante", "login bloqueado", null, { ip, motivo: code });
    return;
  }
  if (ctx.path === "/sign-out") {
    const who = ctx.request ? pendingSignOut.get(ctx.request) : undefined;
    if (who) return audit(who.id, who.email, "saiu do sistema", null, { ip });
    return;
  }
  const action = AUDITED[ctx.path];
  if (!action) return;
  const returned = ctx.context.returned as unknown;
  if (!returned || returned instanceof Error) return; // só ações que deram certo
  const actor = ctx.context.session?.user as { id?: string; email?: string } | undefined;
  const body = (ctx.body ?? {}) as { userId?: string; email?: string; role?: string; banReason?: string };
  const target = body.email ?? (body.userId ? pendingTarget.get(body.userId) ?? (await emailOf(body.userId)) : null);
  if (body.userId) pendingTarget.delete(body.userId);
  const details = { ip, ...(body.role ? { role: body.role } : body.banReason ? { motivo: body.banReason } : {}) };
  await audit(actor?.id ?? null, actor?.email ?? "desconhecido", action, target, details);
});

/** R10–R12: acesso de 6 h; a sessão em si vive 1 h a mais (janela para "Restaurar sessão"). */
export const ACCESS_TTL_MS = 6 * 60 * 60 * 1000;
export const RESTORE_WINDOW_MS = 60 * 60 * 1000;
export const SESSION_TTL_S = (ACCESS_TTL_MS + RESTORE_WINDOW_MS) / 1000;

function createAuth() {
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL) throw new Error("BETTER_AUTH_URL não configurada");
  return betterAuth({
    appName: "EngCalc",
    baseURL,
    basePath: "/api/auth",
    secret: process.env.BETTER_AUTH_SECRET,
    database: getPool(),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID || "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        disableSignUp: true,
        prompt: "select_account",
      },
    },
    account: {
      // O cadastro feito pelo admin é a "verificação" local (requireLocalEmailVerified: false);
      // o Google precisa informar email_verified = true (sem trustedProviders, que pularia essa checagem) — R2.
      accountLinking: { enabled: true, requireLocalEmailVerified: false, allowDifferentEmails: false },
    },
    session: {
      expiresIn: SESSION_TTL_S,
      disableSessionRefresh: true, // sem renovação automática: só "Restaurar sessão" renova
      additionalFields: { accessExpiresAt: { type: "date", required: false, input: false } },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const now = Date.now();
            return { data: { ...session, accessExpiresAt: new Date(now + ACCESS_TTL_MS), expiresAt: new Date(now + ACCESS_TTL_MS + RESTORE_WINDOW_MS) } };
          },
        },
      },
    },
    hooks: { before: auditBefore, after: auditAfter },
    // S5 — rate limit persistido no banco (memória não funciona entre instâncias serverless)
    rateLimit: {
      enabled: true, storage: "database", window: 60, max: 120,
      customRules: { "/sign-in/social": { window: 60, max: 10 }, "/callback/*": { window: 60, max: 20 }, "/admin/*": { window: 60, max: 60 } },
    },
    advanced: { useSecureCookies: baseURL.startsWith("https://") },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  });
}

export function getAuth() {
  if (!instance) instance = createAuth();
  return instance;
}

export type Auth = ReturnType<typeof getAuth>;
