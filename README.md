# EngCalc — Memória de Cálculo Técnica

Sistema web de **memória de cálculo para engenharia mecânica, civil e elétrica**: fórmulas explícitas, verificação de norma (NBR/IEC/ISO), relatórios com ✓/✗/⚠, encadeamento entre cálculos, projetos (obras) e exportação em PDF.

> **Produção:** https://eng-calc-ecru.vercel.app — acesso **somente por convite** (login com Google).
>
> ⚠️ Resultados para fins técnicos e educacionais. Confirme sempre com as normas vigentes e com responsável técnico habilitado.

---

## Sumário
- [Funcionalidades](#funcionalidades)
- [Catálogo de cálculos](#catálogo-de-cálculos)
- [Arquitetura](#arquitetura)
- [Rodando localmente](#rodando-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados e migrações](#banco-de-dados-e-migrações)
- [Autenticação e acesso](#autenticação-e-acesso)
- [Segurança](#segurança)
- [Testes](#testes)
- [Deploy](#deploy)
- [Como contribuir (SDD)](#como-contribuir-sdd)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Pendências conhecidas](#pendências-conhecidas)

---

## Funcionalidades

| Área | O que faz |
|------|-----------|
| **Folha de cálculo** | Fórmulas numeradas, nota técnica, esquema, **carregar exemplo**, **seletor de unidades** (kN/tf/kgf, kN/m/tf/m…), relatório com seções e verificações ✓/✗/⚠ |
| **Próximo passo** | Encadeamento: o resultado abre o próximo cálculo já preenchido (viga contínua → viga CA/sapata, pilar → sapata, motor → cabo → disjuntor, Icc → seção por curto, rede urbana → IDF…) |
| **PDF** | Memória de cálculo A4 com carimbo (responsável, data, revisão), entradas, fórmulas, resultados e aviso legal |
| **Projetos (obras)** | Agrupa cálculos de uma obra, reabre com as entradas salvas, **PDF do projeto** (capa + índice + seções) e **link de leitura** compartilhável (revogável) |
| **Histórico** | Últimos cálculos de cada usuário, salvos no banco |
| **Administração** | Cadastro por convite, papéis, desativar/reativar/remover; **painel de uso** (KPIs, cálculos por dia, ranking) e **registro de atividades** (auditoria) |
| **Sessão** | Acesso de 6 h; tela **"Login expirado"** com **Restaurar sessão** (até 1 h depois) ou **Encerrar** |
| **Interface** | Tela de início animada (prancha técnica), tema claro/escuro, responsiva, respeita `prefers-reduced-motion` |

## Catálogo de cálculos

**30 cálculos**, todos com exemplo e testes automatizados.

<details>
<summary><b>Mecânica (11)</b></summary>

| id | Cálculo | Referência |
|----|---------|-----------|
| `rpm` | Cálculo de RPM | — |
| `conv` | Conversão mm → pol | — |
| `polia` | Relação de polias | — |
| `avanco` | Avanço de roscas | — |
| `cone` | Ângulo de cones | — |
| `tensao` | Tensão normal | — |
| `potencia` | Potência mecânica (W, kW, cv) | — |
| `dilatacao` | Dilatação térmica linear | — |
| `eixo` | Dimensionamento de eixo — fadiga (DE-ASME) | ASME B106.1M / Shigley |
| `parafuso` | Parafusos — pré-carga e torque de aperto | ISO 898-1 · ISO 261 |
| `engrenagem` | Engrenagens cilíndricas de dentes retos | ISO 54 · DIN 867 |
</details>

<details>
<summary><b>Civil (11)</b></summary>

| id | Cálculo | Referência |
|----|---------|-----------|
| `concreto` | Viga CA — flexão, armadura mínima, biela e estribos | NBR 6118:2023 |
| `fundacao` | Sapata isolada rígida | NBR 6122 + NBR 6118 |
| `resistencia` | Pilar CA — 2ª ordem e flexo-compressão | NBR 6118 §15.8 |
| `deflexao` | Viga contínua 2 vãos — 3 momentos | Clapeyron · NBR 6118 Tab. 13.3 |
| `laje` | Laje maciça — momentos (Marcus) e armadura | NBR 6118 §13.2.4 · §19.3 |
| `flecha_ca` | Flecha de viga CA — Branson + fluência | NBR 6118 §17.3.2.1 |
| `ancoragem` | Ancoragem e emenda por traspasse | NBR 6118 §9.4 · §9.5.2 |
| `materiais` | Consumo de materiais (concreto, forma, aço) | Estimativa |
| `tubos` | Águas pluviais prediais — calha e condutores | NBR 10844 |
| `rede_urbana` | Rede de drenagem urbana — método racional | Kirpich + Manning |
| `idf` | Intensidade de chuva — curva IDF | Equações IDF locais |
</details>

<details>
<summary><b>Elétrica (8)</b></summary>

| id | Cálculo | Referência |
|----|---------|-----------|
| `secao_cabo` | Seção do cabo BT — escolha automática (capacidade × queda × curto) | NBR 5410 Tab. 36/37 |
| `cabo_bt` | Cabo BT — cabos em paralelo e queda de tensão | NBR 5410 |
| `cabo_mt` | Cabo MT — corrente e queda de tensão | NBR 14039 |
| `curto_circuito` | Seção mínima por curto-circuito (adiabática) | NBR 5410 §5.3.5 |
| `icc` | Corrente de curto-circuito (trafo + cabo) | IEC 60909 (simplificado) |
| `disjuntor` | Disjuntor — coordenação com o condutor | NBR 5410 §5.3.4 |
| `fator_potencia` | Correção do fator de potência | ANEEL REN 1000/2021 |
| `motor` | Corrente de motor elétrico | NBR 17094 / NBR 5410 |
</details>

Valores de tabela que ainda precisam ser conferidos no texto da norma estão marcados `[CONFIRMAR]` nos `tasks.md` de cada spec (ver [Pendências](#pendências-conhecidas)).

## Arquitetura

```
                    ┌──────────────── Vercel (região gru1 · São Paulo) ────────────────┐
 navegador ──HTTPS──►  Front (React 19 + Vite)       /api/*  →  Vercel Function        │
                    │  apps/frontend/dist                       api/index.ts            │
                    │                                           └─ apps/backend (Node)  │
                    │                                              ├─ roteador próprio  │
                    │                                              ├─ Better Auth       │
                    │                                              └─ @engcalc/core     │
                    └───────────────────────────────────────────────────┬───────────────┘
                                                                        │ pg (pool, TLS verify-full)
                                                          Neon Postgres 18 (São Paulo)
```

| Camada | Tecnologia | Onde |
|--------|-----------|------|
| Motor de cálculo | TypeScript puro, sem dependências | `packages/core` |
| API | Node HTTP + roteador próprio, empacotado como **Vercel Function** | `apps/backend`, `api/index.ts` |
| Autenticação | **Better Auth** (Google OAuth, plugin admin, rate limit no banco) | `apps/backend/src/auth.ts` |
| Banco | **Neon Postgres 18**, driver `pg` + `attachDatabasePool` | `apps/backend/src/db.ts` |
| Front | React 19 + Vite 7, CSS próprio (sem framework) | `apps/frontend` |
| Hospedagem | Vercel (front + função no **mesmo domínio**) | `vercel.json` |

Front e API no mesmo domínio ⇒ sem CORS e cookie de sessão `SameSite=Lax` funciona sem configuração cross-site.

## Rodando localmente

Pré-requisitos: **Node ≥ 20** (testado no 26), npm, acesso ao projeto Neon e às credenciais Google (peça a um admin).

```bash
npm install
cp .env.example .env.local      # preencha os valores (ver tabela abaixo)
npm run build                   # compila core → backend → frontend
npm run db:migrate              # aplica migrações pendentes (idempotente)
npm run db:seed-admin           # cria/promove os e-mails de ADMIN_EMAILS a admin

# em dois terminais:
npm run dev:backend             # API em http://localhost:3000 (lê .env.local da raiz)
npm run dev:frontend            # app em http://localhost:5173 (proxy /api → 3000)
```

Abra **http://localhost:5173** e entre com um e-mail Google cadastrado (o de `ADMIN_EMAILS` serve para o primeiro acesso).

| Script | O que faz |
|--------|-----------|
| `npm run build` | Compila os três pacotes |
| `npm test` | Testes de aceitação do motor (node:test) |
| `npm run dev:backend` / `dev:frontend` | Desenvolvimento local |
| `npm run db:migrate` | Aplica `apps/backend/migrations/*.sql` pendentes |
| `npm run db:seed-admin` | Garante os admins de `ADMIN_EMAILS` |

## Variáveis de ambiente

Local: `.env.local` na raiz (já no `.gitignore`). Produção: **Vercel → Settings → Environment Variables**. **Nunca** commite valores.

| Variável | Uso | Onde |
|----------|-----|------|
| `DATABASE_URL` | Conexão do **app** — papel restrito (só leitura/escrita de dados), host **`-pooler`** | Vercel (Prod + Preview) e local |
| `DATABASE_URL_UNPOOLED` | Conexão **direta do dono** do banco — **só migrações** | Vercel (Prod + Preview) e local |
| `BETTER_AUTH_SECRET` | Chave das sessões (≥ 32 bytes aleatórios: `openssl rand -base64 32`) | Vercel e local |
| `BETTER_AUTH_URL` | URL pública do app (`https://eng-calc-ecru.vercel.app` / `http://localhost:5173`) | Vercel e local |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Cliente OAuth "EngCalc Web" no Google Auth Platform | Vercel e local |
| `ADMIN_EMAILS` | E-mails (vírgula) promovidos a admin pelo `db:seed-admin` | Vercel e local |
| `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_FUNCTION_HOST_SUFFIX` | Gerados pelo `neon env pull`; usados só pela CLI do Neon | apenas local |

> ⚠️ `neon env pull` / `neon deploy` **sobrescrevem** `DATABASE_URL` com o papel dono. Depois de rodá-los, restaure a URL do papel restrito do app (`neon connection-string --role-name <papel-do-app> --pooled`).

**Google Auth Platform** (cliente "EngCalc Web"):
- Origens JS: `https://eng-calc-ecru.vercel.app`, `http://localhost:5173`
- Redirect URIs: `https://eng-calc-ecru.vercel.app/api/auth/callback/google`, `http://localhost:5173/api/auth/callback/google`
- Deploys de **preview** não fazem login (URL diferente não cadastrada no Google) — teste login localmente ou em produção.

## Banco de dados e migrações

Neon Postgres 18 na região de São Paulo (mesma região da função na Vercel).

| Migração | Conteúdo |
|----------|----------|
| `001_auth.sql` | `user`, `session`, `account`, `verification` (Better Auth + plugin admin) |
| `002_calc_history.sql` | Histórico de cálculos por usuário |
| `003_session_access_expiry.sql` | `session.accessExpiresAt` (acesso de 6 h) |
| `004_projects.sql` | `project`, `project_item` |
| `005_audit_log.sql` | Registro de atividades |
| `006_rate_limit.sql` | `rateLimit` do Better Auth |

Regras:
- Toda mudança de schema é um **novo arquivo** `NNN_descricao.sql` (nunca edite um já aplicado). O controle fica na tabela `_migrations`.
- Migrações rodam com o **dono** (`DATABASE_URL_UNPOOLED`); o app usa um papel **restrito** (criado com `neon roles create --access read_write`), que **não** tem permissão de DDL (CREATE/DROP/ALTER/TRUNCATE negados). Novas tabelas criadas pelo dono já ficam acessíveis a ele.
- Rode `npm run db:migrate` **antes** do merge que depende da migração.

## Autenticação e acesso

- **Só Google**, **sem auto-cadastro**: um admin cadastra nome + e-mail em *Administração → Usuários*. No primeiro login com esse e-mail o Better Auth **vincula** a conta Google ao cadastro (o Google precisa confirmar o e-mail como verificado).
- E-mail não cadastrado → *"Você não possui cadastro. Solicite acesso a um administrador."*
- **Todo o sistema exige login** (front e API; só `/api/health*` e `/api/auth/*` são públicas).
- **Sessão:** acesso de **6 h**, sem renovação automática; depois disso a tela *Login expirado* permite **Restaurar** por até **1 h**; passado isso, novo login Google.
- **Admins** não podem ser desativados nem removidos (rebaixe antes); o **último admin** não pode ser rebaixado.
- **Usuário desativado** perde todas as sessões imediatamente e não consegue entrar de novo.

## Segurança

Resumo da [spec 012](specs/012-seguranca/spec.md):

| Controle | Implementação |
|----------|---------------|
| Transporte | HTTPS + HSTS preload (Vercel); TLS `verify-full` com o Neon |
| Cabeçalhos | CSP restritiva, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`, COOP (`vercel.json`) |
| Sessão | Cookie `__Secure-`, HttpOnly, Secure, SameSite=Lax; expiração 6 h + janela de 1 h |
| CSRF | Escritas da API exigem `Origin` do próprio site (403); Better Auth valida origem e `callbackURL` |
| Entrada | JSON obrigatório nas escritas (415), corpo ≤ 256 KB (413), validação de campos no motor |
| Abuso | Rate limit no banco (login 10/min); cotas: 500 históricos, 100 projetos, 300 itens/projeto |
| Acesso | Checagem de dono em projetos/histórico; papel admin verificado no servidor |
| Banco | App com papel de **privilégio mínimo**; SQL 100% parametrizado |
| Auditoria | Login/bloqueio/logout e ações de admin com IP em *Administração → Atividades* |
| Cache | `Cache-Control: no-store` em toda resposta da API |

Encontrou uma falha de segurança? **Não abra issue pública** — use *Security → Report a vulnerability* do GitHub ou fale diretamente com o mantenedor.

## Testes

```bash
npm test
```

Testes de aceitação em `packages/core/test/` (77 casos), com **valores de referência calculados à mão** a partir das fórmulas das normas, um teste que roda o `example` de **todos** os cálculos e um que valida que todo link de encadeamento aponta para campos existentes.

## Deploy

| Branch | Destino |
|--------|---------|
| `feat/*`, `fix/*`, `docs/*` | PR → **`devel`** (gera deploy de preview) |
| `devel` → `main` | PR de release → **produção** (deploy automático na Vercel) |

Checklist de release:
1. `npm test` e `npm run build` passando.
2. Migrações novas aplicadas (`npm run db:migrate`).
3. Variáveis novas cadastradas na Vercel **antes** do merge em `main`.
4. Depois do deploy: `GET /api/health/db` → `{"status":"ok"}`, login com Google e um cálculo de exemplo.

A função roda em **`gru1`** (mesma região do banco). Configuração em `vercel.json` (build, rewrite `/api/*` → função, cabeçalhos de segurança).

## Como contribuir (SDD)

O projeto segue **Spec-Driven Development** — veja [`specs/README.md`](specs/README.md) e a [constituição](specs/constitution.md).

1. **Spec** (`specs/NNN-nome/spec.md`): o quê e por quê, com **casos de teste de valores de referência** → aprovação.
2. **Plano** e **tasks** (`plan.md`, `tasks.md`).
3. **Implementação**: cada task fecha com os testes passando.
4. **Validação** e atualização do status no índice de specs.

Contrato de um cálculo (constituição §7): `formula` (equações separadas por ` | `), `context`, `norma`, `fields` (com `hint`, `optional`, `units`), `example` e `calc()` retornando o relatório no padrão `── SEÇÃO ──` com ✓/✗/⚠ e, opcionalmente, `links` para o próximo cálculo.

| Spec | Tema | Status |
|------|------|--------|
| 001 | Correção dos cálculos | ✅ produção |
| 002 | Acesso por convite + Google + sessão 6 h | ✅ produção |
| 003 | Hospedagem Vercel + Neon | ✅ produção |
| 004–006 | PDF, folha de cálculo, encadeamento | ✅ produção |
| 007 | Projetos (obras) | ✅ produção |
| 008–010 | Novos cálculos (elétrica, civil, mecânica) | ✅ produção |
| 011 | Painel de uso e auditoria | ✅ produção |
| 012 | Endurecimento de segurança | ✔ implementada |

## Estrutura do repositório

```
├── api/index.ts                 # entrada da Vercel Function (reusa apps/backend)
├── apps/
│   ├── backend/
│   │   ├── migrations/          # SQL versionado (001…006)
│   │   ├── scripts/migrate.ts   # db:migrate / db:seed-admin
│   │   └── src/
│   │       ├── app.ts           # roteador, rotas, CSRF, cotas, sessão 6 h
│   │       ├── auth.ts          # Better Auth, auditoria, regras de admin
│   │       ├── db.ts            # pool pg (Neon)
│   │       └── server.ts        # servidor local
│   └── frontend/src/
│       ├── main.tsx             # app, navegação, histórico
│       ├── login.tsx            # tela de início, splash, login expirado
│       ├── worksheet.tsx        # folha de cálculo, PDF
│       ├── projects.tsx         # projetos
│       ├── admin.tsx            # uso e atividades
│       ├── account.tsx          # cliente de auth, usuários, sessão
│       └── sidebar.tsx          # menu lateral e switch de tema
├── packages/
│   ├── core/src/                # motor: mecanica.ts, civil.ts, eletrica.ts, lib/ (concreto, hidráulica, NBR 5410)
│   └── shared/                  # tipos compartilhados
├── specs/                       # SDD: constituição, specs 001–012, backlog
├── neon.ts                      # configuração do projeto Neon
└── vercel.json                  # build, rewrites, cabeçalhos
```

## Pendências conhecidas

- **Trocar o `GOOGLE_CLIENT_SECRET`** (spec 012 · S10).
- Conferir no texto oficial os valores `[CONFIRMAR]` listados em `specs/001-*/tasks.md`, `008-*`, `009-*` e `010-*` (tabelas de Iz da NBR 5410, coeficientes de laje de Marcus, equações IDF por cidade, fatores de agrupamento de cabos enterrados).
- Ideias futuras: [`specs/backlog.md`](specs/backlog.md).

---

Projeto acadêmico · 2026.
