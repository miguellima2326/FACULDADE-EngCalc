# Spec 002 — Acesso por convite (admin) + login com Google

**Status:** ✅ aprovada (2026-11-23) — revisada com decisões do usuário · **Depende de:** [003 hospedagem](../003-hospedagem/spec.md) (precisa de banco)

## Objetivo
Acesso **somente por convite**: um **admin** cadastra a pessoa (nome + e-mail do Google que ela vai usar).
A pessoa entra **apenas com "Entrar com Google"**; no primeiro login, a conta Google é **vinculada**
automaticamente ao cadastro feito pelo admin (mesmo e-mail). Fase 1: só Google.

## Histórias
1. **Admin cadastra usuário:** em "Administração", informo nome, e-mail e papel (`user` ou `admin`).
2. **Primeiro login:** a pessoa clica em "Entrar com Google"; o e-mail do Google bate com o cadastro → conta Google vinculada ao usuário e sessão criada.
3. **Logins seguintes:** "Entrar com Google" → mesmo usuário (mesmo id).
4. **Sem cadastro:** e-mail Google não cadastrado → **bloqueia** com a mensagem "Você não possui cadastro. Solicite acesso a um administrador." Nada é criado no banco.
5. **Admin gerencia:** lista usuários, vê se já vincularam o Google, desativa (bane) ou remove usuário, promove a admin.
6. **Tela de login primeiro:** quem não está logado vê apenas a tela de login (com o aviso de acesso por convite).
7. **Histórico na conta:** o histórico de cálculos passa a ser salvo por usuário (importa o do `localStorage` no primeiro login).

## Regras
| ID | Regra |
|----|-------|
| R1 | Não existe auto-cadastro. Google com e-mail não cadastrado → erro "não possui cadastro" (história 4). |
| R2 | Vínculo só com e-mail **idêntico** (case-insensitive) ao cadastrado pelo admin e com `email_verified = true` informado pelo Google. |
| R3 | Uma conta Google pertence a um único usuário. |
| R4 | Primeiro admin vem da variável `ADMIN_EMAILS` (seed), já que ninguém pode se cadastrar sozinho. |
| R5 | Sem senha na fase 1 (nada de hash de senha para gerenciar). |
| R6 | Sessão em cookie `HttpOnly`, `Secure`, `SameSite=Lax`, mesmo domínio do front. |
| R7 | **Todo o sistema exige login** (revisado em 2026-11-23): sem sessão, o front mostra só a tela de login e a API recusa cálculos/catálogo com 401. Apenas `/api/health*` e `/api/auth/*` são públicas. |
| R8 | Usuário desativado (banido) não consegue entrar mesmo com Google válido. |
| R9 | Rotas `/api/admin/*` exigem papel `admin` (verificado no servidor, nunca só no front). |

## Aceitação
- [ ] Admin cadastra `fulano@gmail.com` → fulano entra com Google → tabela `account` tem `provider_id = google` ligado ao `user.id` do cadastro.
- [ ] Segundo login de fulano → mesmo `user.id`.
- [ ] `ciclano@gmail.com` (não cadastrado) → mensagem "não possui cadastro"; tabela `user` inalterada.
- [ ] Usuário banido → login recusado.
- [ ] Usuário comum chamando `/api/admin/linked` ou `/api/auth/admin/*` → 403.
- [ ] Sem login: front mostra só a tela de login; `POST /api/calculations/...` → 401.
- [ ] Topo da página logado: só o ícone do usuário (abre o menu).

## Proposta técnica
- **Better Auth** (biblioteca de auth em TypeScript, roda no backend Node): provedor Google com
  cadastro implícito desabilitado (`disableImplicitSignUp`), vínculo de contas (`accountLinking`,
  `trustedProviders: ["google"]`) e plugin `admin` (papéis, banir, criar usuário).
- O banco é o Postgres da spec 003, com as tabelas `user`, `account`, `session`, `verification` + `calc_history`.
- Google OAuth: criar as credenciais no Google Cloud Console, com redirect URI
  `https://<dominio>/api/auth/callback/google`.

## Perguntas em aberto
Nenhuma (decididas em 2026-11-23).
