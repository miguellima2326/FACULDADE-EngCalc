# Spec 013 — Passo a passo, exemplos de livro, comparação, orçamento e navegação

**Status:** ✔ implementada (pedido do usuário em 2026-11-24)

## Motivação
O site já calcula certo (testes com gabarito externo em `packages/core/test/REFERENCIAS.md`), mas o
estudante não via **como** se chega ao resultado, e o engenheiro não tinha como comparar alternativas
nem orçar a obra. A API também descartava os links de "Próximo passo" (bug corrigido aqui).

## Requisitos
| ID | Requisito | Onde |
|----|-----------|------|
| P1 | Todo cálculo devolve `steps`: fórmula, números substituídos e resultado de cada conta (vírgula decimal). Mostrado como "Passo a passo" e anexado ao relatório salvo, copiado e impresso. | `core/src/lib/steps.ts`, cada `calc()` |
| P2 | "Conferir minha resposta": o usuário digita o valor de cada passo; tolerância de 1 % (ou meia unidade da última casa); aponta o **primeiro passo divergente**. | `frontend/src/steps.tsx` |
| P3 | "Exemplos de livro": botões que carregam exemplos publicados (Bastos/UNESP, Prysmian, WEG, memorial TRF2), mostram a fonte, a página e o PDF, e marcam ✓/✗ "livro" em cada passo. Os mesmos exemplos são testes automáticos. | `core/src/referencias.ts`, `test/referencias.test.ts` |
| P4 | Tela "Tabelas de consulta" com os mesmos dados dos cálculos: barras, lb, ρmín, Iz, resistência, k, disjuntores, capacitores, roscas, módulos, aços. | `frontend/src/tables.tsx` |
| P5 | "Comparar alternativa": fixa o resultado A; após recalcular, mostra entradas alteradas e A × B × Δ % por passo. | `CompareBlock` |
| P6 | Quantitativo (`materials`) em viga, sapata, pilar, laje, consumo de materiais e cabos; tabela de custo com preço unitário salvo no navegador. | `CostTable` |
| P7 | Projeto soma os quantitativos de todos os itens (linhas `▸` do relatório salvo) e inclui "Resumo de materiais e custo" no PDF. | `projects.tsx`, `PrintCost` |
| P8 | Busca de cálculos em todas as áreas (sem acento, várias palavras). | `calc-index.tsx` |
| P9 | Favoritos (★, no navegador) e Recentes (do histórico) no topo do índice. | `calc-index.tsx` |
| P10 | A API repassa `links`, `steps` e `materials` (antes só `value/unit/multi`). | `backend/src/app.ts` |

## Fora do escopo
- Modo offline (PWA) — adiado a pedido do usuário.
- Exemplos de livro de mecânica (Shigley/Norton não estão abertos na internet).

## Limitações conhecidas
- Quantitativos são estimativas sem perdas; sapata como bloco retangular; pilar sem estribos; laje só armaduras positivas.
- O resumo do projeto lê o quantitativo do relatório salvo: itens salvos antes desta spec não entram na soma.
