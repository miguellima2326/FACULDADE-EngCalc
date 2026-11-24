# Tasks 002

- [x] T1 Better Auth no backend (`apps/backend/src/auth.ts`): Google com `disableSignUp`, vínculo por e-mail, plugin admin
- [x] T2 Migrações versionadas (`apps/backend/migrations/*.sql`) + `npm run db:migrate` (conexão direta) — aplicadas no Neon
- [x] T3 Seed do primeiro admin (`ADMIN_EMAILS` → `npm run db:seed-admin`) — R4
- [x] T4 Rotas: `/api/auth/*`, `/api/history` (GET/POST/DELETE), `/api/admin/linked`; cálculos/catálogo exigem sessão — R7/R9
- [x] T5 Front: tela de início animada com login (gate), avatar abre o menu, área de Administração, histórico na nuvem com importação do local
- [x] T6 Teste local: vínculo no 1º login ✓, e-mail não cadastrado bloqueado (`signup_disabled`) ✓, rotas protegidas 401 ✓
- [ ] T7 Variáveis na Vercel (GOOGLE_CLIENT_ID/SECRET, BETTER_AUTH_SECRET, BETTER_AUTH_URL) + URIs de produção no Google + deploy

## Decisão registrada
- `requireLocalEmailVerified: false` + Google **não** é provedor confiável: o cadastro do admin vale como verificação local
  e o Google precisa confirmar `email_verified` (R2). Com o padrão do Better Auth o vínculo era recusado (`account_not_linked`).
