# Fontes dos testes de referência (`referencias.test.ts`)

Os valores esperados desses testes **não foram calculados por nós**: eles vêm de
exemplos resolvidos publicados. Se o código discordar da fonte, o teste falha.
As páginas indicadas são as do **visualizador de PDF**, não as impressas no rodapé.

Os exemplos de `src/referencias.ts` também aparecem no site como botões **"Exemplos de livro"**,
e cada um é conferido passo a passo pelo mesmo arquivo de teste.

## Civil — NBR 6118:2023 (concreto armado)

Apostilas do Prof. Dr. Paulo Sérgio dos Santos Bastos, UNESP Bauru, revisadas para a NBR 6118:2023.

| Teste | Fonte | Onde | Valores conferidos |
|---|---|---|---|
| Flexão, ex. 1 | *Flexão Normal Simples – Vigas*: [FlexaoSimples.pdf](https://wwwp.feb.unesp.br/pbastos/concreto1/FlexaoSimples.pdf) | item 7.3, 1º exemplo (pág. 21–23) | x = 18,1 cm; As = 8,10 cm²; As,mín = 1,50 cm² |
| Flexão, ex. 3 | mesma apostila | item 7.3, 3º exemplo (pág. 32) | x = 16,2 cm; As = 9,95 cm²; As,mín = 1,98 cm² |
| Cortante, Modelo I | *Dimensionamento de Vigas à Força Cortante*: [Cortante.pdf](https://wwwp.feb.unesp.br/pbastos/concreto2/Cortante.pdf) | item 5.15, Exemplo Numérico 1 (pág. 45–47) | VSd = 153,0; VRd2 = 279,5; Vc = 49,6; Vsw = 103,4 kN; Asw/s = 5,73; Asw,mín = 1,44 cm²/m |
| Ancoragem | *Ancoragem e Emenda de Armaduras*: [Ancoragem.pdf](https://wwwp.feb.unesp.br/pbastos/concreto2/Ancoragem.pdf) | Tabela A-1, CA-50 nervurado (pág. 28) | 10 células da tabela (φ10 a φ25, C20 a C40, boa/má aderência, com/sem gancho) |

**Observação (ancoragem com CA-60):** a Tabela A-2 do Bastos usa η1 = 1,0 para o CA-60.
O app usa η1 = 1,4 para barra entalhada (CA-60), como manda a NBR 6118, Tab. 8.2.
Com isso o app dá um comprimento menor que a tabela do Bastos. Por esse motivo a Tabela A-2 não entrou nos testes.

## Elétrica

| Teste | Fonte | Onde | Valores conferidos |
|---|---|---|---|
| Seção por curto-circuito | Prysmian, *Guia de Dimensionamento de Cabos para Baixa Tensão*, Rev. 9: [PDF](https://br.prysmian.com/sites/default/files/atoms/files/Guia_de_Dimensionamento-Baixa_Tensao_Rev9.pdf) | item 7, exemplo (pág. 44) | 10 kA, 0,5 s: k = 143 → 49,44 mm² (→ 50); 176 → 40,17; 159 → 44,47; 128 → 55,24 (→ 70); 228 → 31,01 mm² |
| Icc no secundário do trafo | TRF 2ª Região, *Memorial de Cálculo de Curto-Circuito*, que cita Cotrim, *Instalações Elétricas*, 5ª ed.: [PDF](https://trf2.jus.br/system/files/2026/07/memorial_curto_circuito.pdf) | Etapa 1 (pág. 1–2) | 1000 kVA, 220 V, Z = 6,45 % → In = 2624,5 A; Icc = 40,69 kA |
| Fator F do capacitor | WEG, *Corrección del Factor de Potencia*, catálogo 50034873: [PDF](https://static.weg.net/medias/downloadcenter/h6f/h9f/WEG-correcion-del-factor-de-potencia-50034873-catalogo-es.pdf) | tabela de F (pág. 10) | 7 células, por exemplo 0,80 → 0,92 = 0,324 |
| Capacitor do motor | mesmo catálogo | exemplo do motor W22 55 kW (pág. 11) | 9,73 kvar |
| Corrente antes da correção | mesmo catálogo | exemplo de 930 kW (pág. 8) | S = 1431 kVA; I = 2174 A |

**Divergências encontradas nas fontes (o app está certo nos dois casos):**

1. **WEG, exemplo do motor:** o enunciado diz FP atual = 0,85, mas usa F = 0,220.
   Esse valor é da linha **0,84** da tabela, que não tem linha 0,85. O valor correto para 0,85 → 0,92 é
   F = tan(acos 0,85) − tan(acos 0,92) = 0,1937, ou seja, 8,58 kvar em vez de 9,73 kvar.
   O teste reproduz o número publicado usando FP 0,84 e também confere o valor correto para 0,85.
2. **Memorial TRF2:** o memorial escreve In ≈ 2624,5 A, mas o valor exato é 2624,3 A.
   A diferença vem do arredondamento de √3 e não altera o Icc (40,69 kA).

## Áreas ainda sem gabarito externo

- **Mecânica** (eixo, parafuso, engrenagem): os exemplos clássicos estão no Shigley e no Norton, que não estão abertos na internet.
  Esses testes devem ser conferidos com o livro físico ou com o professor.
- **Queda de tensão, capacidade de condução (Iz), sapata, pilar, laje e flecha** ainda não foram comparados com nenhum exemplo publicado.
