# Constituição do EngCalc

Princípios que toda spec, plano e implementação devem respeitar.

## 1. Fórmula sempre explícita
- O campo `formula` mostra **todas** as equações usadas, na ordem em que são aplicadas.
- O relatório (`multi: true`) mostra cada grandeza intermediária com unidade, no padrão:
  ```
  ── SEÇÃO ─────────────────────────────
  Nome:          valor unidade   (expressão usada)
  ✓ / ✗ / ⚠ conclusão
  ```
- Constantes e coeficientes (γc, γs, k, fatores de correção) aparecem no relatório com sua origem.

## 2. Norma rastreável
- Todo critério normativo cita norma + item/tabela (ex.: `NBR 6118:2023 §17.3.5.2.1`).
- Valores tabelados ficam em constantes nomeadas com a tabela de origem no comentário.
- Simplificações ou aproximações são declaradas no relatório com `⚠`.

## 3. Responder o que o engenheiro não tem
- Se um dado de entrada costuma ser desconhecido (ex.: Iz, K, Icc, intensidade de chuva),
  o cálculo deve **estimar** a partir de dados mais básicos ou de tabela de norma,
  dizendo de onde veio o valor.
- O resultado final é uma **recomendação acionável** (seção comercial, bitolas + espaçamento, DN etc.).

## 4. Entradas confiáveis
- Campo obrigatório vazio é erro, **nunca** vira 0.
- Campos opcionais são declarados como `optional: true`.
- Unidades fixas por campo (`hint`) e validação de faixa física.

## 5. Testes de valores de referência
- Cada cálculo tem testes automatizados (`node:test`) com ao menos:
  um caso típico, um caso-limite e um caso que deve falhar/alertar.
- Valor de referência com tolerância explícita (ex.: ±0,5 %).

## 6. Aviso legal
- Resultados são para fins educacionais; o rodapé e o relatório lembram que o projeto
  final exige responsável técnico habilitado.

## 7. Contrato de um cálculo (convenções, a partir da spec 005)
Além de `id`, `name`, `desc`, `formula`, `context`, `norma`, `fields`, `calc`:
- **`example`** — `Record<campo, valor>` com entradas válidas e realistas (preferir os casos dos testes).
  O botão "carregar exemplo" usa isso.
- **`fields[].units`** (opcional) — unidades alternativas aceitas no campo:
  `[{ value: "kN", factor: 1 }, { value: "tf", factor: 9.80665 }]`. O **primeiro** item é a unidade-base
  (igual ao `hint`); o front converte `valor × factor` antes de enviar. O motor só recebe a unidade-base.
- **`links`** (opcional, no retorno de `calc`) — encadeamento para outro cálculo com valores pré-preenchidos:
  `links: [{ label: "Dimensionar seção do apoio B", area: "civil", calcId: "concreto", values: { ... } }]`.
- Fórmulas: o campo `formula` separa equações com ` | `; o front mostra uma por linha, na ordem.
