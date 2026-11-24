import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
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
    advanced: { useSecureCookies: baseURL.startsWith("https://") },
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] })],
  });
}

export function getAuth() {
  if (!instance) instance = createAuth();
  return instance;
}

export type Auth = ReturnType<typeof getAuth>;
