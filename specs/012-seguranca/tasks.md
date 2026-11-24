# Tasks 012

- [x] S1 Cabeçalhos (vercel.json): CSP, X-Frame-Options DENY, nosniff, Referrer-Policy same-origin, Permissions-Policy, COOP — 0 violações de CSP no teste headless
- [x] S2 `Cache-Control: no-store` + `nosniff` em toda resposta da API
- [x] S3 CSRF: escrita só com Origin/Referer do próprio site (403 caso contrário); proxy do Vite repassa `x-forwarded-host`
- [x] S4 corpo ≤ 256 KB (413 já na entrada) e JSON obrigatório nas escritas (415)
- [x] S5 rate limit do Better Auth no banco (`rateLimit`, migração 006): login 10/min, callback 20/min, admin 60/min, geral 120/min — 429 testado
- [x] S6 cotas: 500 registros de histórico/usuário, 100 projetos/usuário, 300 itens/projeto
- [x] S7 auditoria de login (entrou / bloqueado com motivo / saiu) com IP; IP também nas ações de admin
- [x] S8 TLS `verify-full` com o Neon (app e migrações)
- [x] Extra (pedido): admin não pode ser desativado nem removido; não rebaixa o último admin — validado no servidor (hook) e escondido no front
- [x] Extra (pedido): usuário desativado perde todas as sessões (plugin admin) + checagem em toda requisição (derruba sessão restante) + front volta ao login com aviso
- [ ] S9 (manual) papel de banco com privilégio mínimo para a aplicação
- [ ] S10 (manual) trocar `GOOGLE_CLIENT_SECRET`
