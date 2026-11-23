# Spec 003 — Nova hospedagem do backend e do banco

**Status:** ✅ aprovada (2026-11-23)

## Situação atual (verificada no repositório)
- Front: Vercel (`vercel.json`) ✅
- Back: Render (`render.yaml`), mas a cota gratuita acabou ❌
- **Banco: não existe.** Nenhum código usa banco hoje (sem driver/ORM/conexão); o histórico fica no
  `localStorage` do navegador. O banco passa a ser necessário com o login (spec 002).

## Decisão proposta
| Parte  | Onde | Por quê |
|--------|------|---------|
| Front  | Vercel (fica como está) | já funciona |
| Back   | **Vercel Functions, no mesmo projeto do front** | A API é pequena e sem estado (o `server.ts` tem 45 linhas), então cabe em funções serverless. Não precisa de um segundo serviço. Front e API ficam no **mesmo domínio**: some o problema de CORS e o cookie de login (spec 002) funciona sem configuração cross-site. |
| Banco  | **Neon Postgres** (plano Free) | Postgres serverless com plano gratuito sem cartão; integra direto na Vercel (Marketplace), que injeta a `DATABASE_URL`. Em out/2026, o plano Free tem 1 GB por projeto e 100 CU-horas/mês (sobra muito para um projeto de faculdade). |

Alternativas consideradas: Supabase (pausa o projeto após inatividade no plano gratuito),
Koyeb ou Google Cloud Run para o backend (seria um segundo serviço e o cookie ficaria cross-domain),
Railway/Fly.io (sem plano gratuito permanente).

## Requisitos
| ID | Requisito |
|----|-----------|
| H1 | `apps/backend` vira um handler reutilizável: `server.ts` (local, `npm run dev:backend`) e `api/[...path].ts` (Vercel) usam o **mesmo** roteador. |
| H2 | Rotas preservadas: `GET /api/health`, `GET /api/catalog`, `GET /api/cable-catalog`, `POST /api/calculations/:area/:id`. |
| H3 | `VITE_API_URL` vazio em produção, ou seja, o front chama `/api/...` no mesmo domínio. |
| H4 | `DATABASE_URL` só em variável de ambiente (Vercel + `.env` local, que está no `.gitignore`), nunca no código. |
| H5 | Migrações do banco versionadas no repositório (Drizzle ou SQL puro). |
| H6 | `render.yaml` removido depois da migração validada. |

## Aceitação
- [ ] O preview deploy da Vercel responde `GET /api/health` → `{"status":"ok"}`.
- [ ] Os cálculos funcionam no preview sem nenhuma chamada a domínio do Render.
- [ ] `npm run dev:backend` + `npm run dev:frontend` continuam funcionando localmente.
- [ ] A conexão com o Neon é testada por uma rota `GET /api/health/db`.

## Observação
Os limites do plano gratuito mudam com o tempo; confira em neon.com/pricing antes de criar o projeto.
