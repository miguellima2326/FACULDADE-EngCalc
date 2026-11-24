import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
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

const auditBefore = createAuthMiddleware(async (ctx) => {
  if (!AUDITED[ctx.path]) return;
  const body = (ctx.body ?? {}) as { userId?: string };
  const email = await emailOf(body.userId);
  if (body.userId && email) pendingTarget.set(body.userId, email);
});

const auditAfter = createAuthMiddleware(async (ctx) => {
  const action = AUDITED[ctx.path];
  if (!action) return;
  const returned = ctx.context.returned as unknown;
  if (!returned || returned instanceof Error) return; // só ações que deram certo
  const actor = ctx.context.session?.user as { id?: string; email?: string } | undefined;
  const body = (ctx.body ?? {}) as { userId?: string; email?: string; role?: string; banReason?: string };
  const target = body.email ?? (body.userId ? pendingTarget.get(body.userId) ?? (await emailOf(body.userId)) : null);
  if (body.userId) pendingTarget.delete(body.userId);
  const details = body.role ? { role: body.role } : body.banReason ? { motivo: body.banReason } : {};
  try {
    await getPool().query(
      `insert into "audit_log"("actorId","actorEmail","action","targetEmail","details") values ($1,$2,$3,$4,$5)`,
      [actor?.id ?? null, actor?.email ?? "desconhecido", action, target, JSON.stringify(details)]);
  } catch (error) { console.error("audit_log", error); }
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
    advanced: { useSecureCookies: baseURL.startsWith("https://") },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  });
}

export function getAuth() {
  if (!instance) instance = createAuth();
  return instance;
}

export type Auth = ReturnType<typeof getAuth>;
