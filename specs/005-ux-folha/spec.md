# Spec 005 — Experiência na folha de cálculo

**Status:** ✅ aprovada (escopo aprovado em 2026-11-23)

| ID | Requisito | Aceitação |
|----|-----------|-----------|
| U1 | **Carregar exemplo**: botão na folha preenche os campos com `calc.example` (constituição §7). | Todo cálculo tem `example`; teste automatizado roda cada exemplo sem erro. |
| U2 | **Rolar até o resultado** após "Calcular" (desconta o cabeçalho fixo; respeita reduced-motion). | Clicar em Calcular na sapata leva ao relatório. |
| U3 | **Fórmulas legíveis**: `formula` dividida em ` \| ` vira lista numerada de equações. | Viga CA mostra 9 equações numeradas. |
| U4 | **Conversor de unidades no campo**: quando `field.units` existe, um seletor ao lado do campo; o valor é convertido para a unidade-base antes do envio e o relatório informa a conversão. | Carga 2 tf/m na viga contínua = 19,61 kN/m. |
| U5 | **Limpar campos** e manter o último cálculo feito ao trocar de aba. | — |

Decisão: renderização KaTeX ficou fora (dependência pesada); U3 resolve a legibilidade.
