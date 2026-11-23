# Plano 001 — Correção dos cálculos

## Abordagem
1. **Testes primeiro.** Criar `packages/core/test/*.test.ts` com os casos de aceitação da spec.
   Rodar com `node --import tsx --test`. Os testes 🔴 devem **falhar** antes da correção.
2. **Corrigir por cálculo**, um commit por bloco (A, B, C…), mantendo id, campos e o
   formato de relatório existentes (constituição §1).
3. **Extrair tabelas normativas** para `packages/core/src/tables/` (`nbr5410.ts`, `nbr6118.ts`)
   com a tabela/item de origem em comentário.
4. **Helpers numéricos** em `packages/core/src/math.ts`: `bisect`, `interp`,
   `circularPartialFlow(yD)`.
5. **Plataforma (H1):** frontend envia `null` para campo vazio; `calculate()` valida
   obrigatórios antes de chamar `calc()`.

## Ordem (pelo risco)
A (viga contínua) → E (drenagem) → C (sapata) → B (viga CA) → D (pilar) → H1 → F (elétrica) → G.

D1 (flexo-compressão) é o item mais trabalhoso: implementar equilíbrio da seção retangular
com diagrama parábola-retângulo simplificado (0,8x · 0,85fcd) e armadura simétrica em 2 camadas,
resolvido por bisseção na linha neutra x.

## Riscos
- Itens `[CONFIRMAR NA NORMA]` podem mudar valores tabelados → isolados em `tables/`.
- Mudar entradas da sapata (Nd → Nk) quebra o histórico salvo no navegador → aceitar (versão 3.x).
