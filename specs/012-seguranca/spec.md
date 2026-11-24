# Spec 012 — Endurecimento de segurança

**Status:** ✅ aprovada (pedido do usuário em 2026-11-23)

## Diagnóstico (produção, 2026-11-23)
| Item | Situação |
|------|----------|
| HTTPS + HSTS (preload) | ✅ Vercel |
| Cookies de sessão | ✅ `__Secure-`, HttpOnly, Secure, SameSite=Lax |
| Redirect aberto no login (`callbackURL` externo) | ✅ bloqueado pelo Better Auth (`INVALID_CALLBACK_URL`) |
| SQL injection | ✅ todas as queries parametrizadas |
| Controle de acesso (IDOR) | ✅ projetos/itens/histórico checam o dono; admin checa papel no servidor |
| Segredos no histórico do git | ✅ nenhum encontrado |
| Dependências (`npm audit`) | ✅ 0 vulnerabilidades |
| **Cabeçalhos de segurança** (CSP, X-Frame-Options, nosniff, Referrer/Permissions-Policy) | ❌ ausentes |
| **Cache das respostas da API** | ❌ `public, max-age=0` em JSON autenticado |
| **CSRF nas rotas próprias** (POST/PUT/DELETE) | ⚠ só SameSite=Lax; sem checagem de origem |
| **Tamanho do corpo** das requisições | ❌ sem limite |
| **Rate limit** do login | ⚠ em memória (ineficaz em serverless) |
| **Cotas por usuário** (histórico/projetos) | ❌ ilimitado |
| **Auditoria de login** (sucesso/bloqueio) | ❌ só ações de admin |
| TLS com o banco | ⚠ `sslmode=require` (aviso do driver) |
| Papel do banco | ⚠ app usa o dono do banco (pode `DROP`) |
| Segredo do Google | ⚠ exposto no chat — precisa ser trocado |

## Requisitos
| ID | Requisito |
|----|-----------|
| S1 | Cabeçalhos em todas as respostas: **CSP** restritiva (`default-src 'self'`, fontes Google, avatares `lh3.googleusercontent.com`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy` negando câmera/microfone/geolocalização, `Cross-Origin-Opener-Policy: same-origin`. |
| S2 | Respostas da API com `Cache-Control: no-store`. |
| S3 | **Checagem de origem** (CSRF) em todo método não-GET das rotas próprias: `Origin`/`Referer` deve ser o próprio site; senão 403. |
| S4 | Corpo JSON limitado a **256 KB** (413) e `Content-Type: application/json` obrigatório nas escritas (415). |
| S5 | **Rate limit** do Better Auth com armazenamento no **banco** (tabela `rateLimit`), regras mais duras no login. |
| S6 | **Cotas**: histórico mantém os 500 mais recentes por usuário; até 100 projetos por usuário e 300 itens por projeto. |
| S7 | **Auditoria de login**: login bem-sucedido, login bloqueado (sem cadastro/desativado) e logout no `audit_log`, com IP. |
| S8 | TLS com o banco em `verify-full`. |
| S9 | (manual) **papel de banco com privilégio mínimo** para a aplicação (só DML); migrações seguem com o dono. |
| S10 | (manual) **trocar o `GOOGLE_CLIENT_SECRET`** exposto. |

## Aceitação
- [ ] `curl -I` em produção mostra os cabeçalhos de S1 e `no-store` na API.
- [ ] `POST /api/projects` com `Origin: https://evil.example` → 403.
- [ ] Corpo de 300 KB → 413; `Content-Type: text/plain` → 415.
- [ ] Login aparece na aba Atividades do admin.
- [ ] Todos os testes continuam passando; app funciona com a CSP (sem erros no console).
