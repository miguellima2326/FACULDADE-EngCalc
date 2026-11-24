# Spec 004 — Exportar memória de cálculo em PDF

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

## Objetivo
Gerar o documento que o engenheiro entrega: a memória de cálculo de um cálculo (e, com a spec 007, de um projeto inteiro).

## Requisitos
| ID | Requisito |
|----|-----------|
| P1 | Botão **"Gerar PDF"** no resultado de qualquer cálculo. |
| P2 | Conteúdo: carimbo/capa (EngCalc, título do cálculo, norma, responsável = usuário logado, data/hora), **dados de entrada** com unidades, **fórmulas** (uma por linha), **relatório de resultados** com ✓/✗/⚠, **nota técnica** e **aviso legal**. |
| P3 | Layout A4 retrato, fonte mono para valores, sem elementos de navegação; quebra de página sem cortar linhas do relatório. |
| P4 | Implementação via folha de impressão (`@media print` + `window.print()` → "Salvar como PDF"): zero dependências, texto selecionável. |
| P5 | Funciona nos temas claro e escuro (impressão sempre em fundo branco). |

## Aceitação
- [ ] Gerar PDF da viga contínua exemplo → 1 página A4 com entradas, fórmulas, M_B = −45,00 e carimbo com nome do usuário.
- [ ] Relatório longo (pilar) → quebra de página sem cortar linha.
