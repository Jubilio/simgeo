# Scientific Development Framework

Este documento define como o SimGeo transforma uma pergunta geográfica num
produto científico reproduzível. O objetivo não é tratar cada mapa como uma
verdade observada, mas tornar explícitos o método, os dados, a incerteza e as
condições de uso.

O processo adapta as recomendações de Bridgeford et al. (2026),
[Twelve quick tips for AI-assisted coding in science](https://doi.org/10.1371/journal.pcbi.1014428),
ao desenvolvimento de um WebGIS de apoio à decisão.

## Princípios obrigatórios

1. **A pergunta vem antes do código.** Cada módulo deve declarar a pergunta
   científica, o uso decisório permitido e os usos proibidos.
2. **Dados e método são versionados.** Dataset, coleção, banda, período,
   resolução, CRS, escala de redução, equação e limiares devem ser rastreáveis.
3. **Testes são especificações.** Casos esperados, limites e falhas são
   definidos antes ou em conjunto com a implementação.
4. **Validação é progressiva.** Um teste unitário não equivale a validação de
   campo; o nível alcançado deve ser declarado sem ambiguidade.
5. **Mudanças são incrementais.** Um PR deve ter um objetivo verificável e não
   misturar refatorações não relacionadas.
6. **A responsabilidade permanece humana.** Código assistido por IA deve ser
   compreendido, revisto e defendido por quem o publica.
7. **A incerteza aparece no produto.** Limitações relevantes devem estar na
   API, na interface e na documentação, não apenas no código.

## Fluxo de desenvolvimento

### Gate 1 — Enquadramento

Antes da implementação, abrir uma proposta usando o template **Scientific
module** e responder:

- qual pergunta será respondida;
- qual decisão o resultado pode apoiar;
- quais dados, escalas e períodos são adequados;
- quais resultados não podem ser inferidos;
- qual área de referência permitirá verificar o comportamento;
- quais falhas previsíveis devem ser tratadas.

### Gate 2 — Especificação

Criar a ficha em `docs/scientific-modules/specs/` a partir de
`docs/scientific-modules/TEMPLATE.md` e registar o módulo em
`docs/scientific-modules/registry.json`.

A especificação deve separar claramente:

- perigo, exposição, vulnerabilidade, impacto e contexto;
- dado observado, estimativa modelada, proxy e cenário;
- resolução nominal do dado e escala efetiva do resultado;
- saldo líquido, fluxo bruto e mudança relativa, quando aplicável.

### Gate 3 — Testes antes da integração

O conjunto mínimo inclui:

- validação de parâmetros e tipos;
- limites temporais, espaciais e numéricos;
- unidade, sinal e intervalo dos resultados;
- geometrias vazias, inválidas ou fora de Moçambique;
- falhas de autenticação, timeout, quota e resposta externa;
- um caso de regressão para cada erro corrigido;
- confirmação de que segredos não aparecem na resposta.

Mocks são aceitáveis para testar contratos e falhas, mas não provam que uma
análise Earth Engine está cientificamente correta. Sempre que possível, manter
um caso de referência executável com dados reais e tolerâncias declaradas.

### Gate 4 — Implementação incremental

A sequência recomendada é:

1. funções puras e validação de parâmetros;
2. serviço espacial ou científico;
3. contrato da API e respostas de erro;
4. camada cartográfica;
5. painel e interpretação;
6. documentação e exemplo reproduzível.

Cada fase deve terminar com testes e um diff que possa ser revisto de forma
independente.

### Gate 5 — Validação científica

O SimGeo utiliza a seguinte escala:

| Nível | Evidência | O que permite afirmar |
| --- | --- | --- |
| V0 | código compila e formato é válido | apenas integridade técnica básica |
| V1 | testes unitários e de contrato | regras implementadas como especificado |
| V2 | integração com serviço/dado real | pipeline executa no ambiente-alvo |
| V3 | caso de referência e comparação independente | comportamento espacial/numérico plausível |
| V4 | revisão por especialista ou validação de campo | aptidão para o uso operacional declarado |

O nível deve constar no registo científico. Nenhum módulo pode ser descrito
como “validado” sem indicar o nível e a evidência.

### Gate 6 — Revisão e merge

O PR deve passar por:

- validação do registo científico;
- testes Django;
- lint e build do frontend;
- revisão do diff completo;
- checklist metodológico e declaração de assistência por IA;
- confirmação de que documentação, API e interface dizem a mesma coisa.

### Gate 7 — Operação e aprendizagem

Falhas de produção devem ser registadas em `docs/KNOWN_ISSUES.md`. Cada correção
deve acrescentar um teste de regressão. Alterações de fonte, versão, peso,
limiar, CRS ou escala são mudanças metodológicas e exigem atualização da ficha
do módulo.

## Definição de concluído

Um módulo científico está concluído quando:

- está no registo e a validação automática passa;
- possui pergunta, fontes, método, unidades, escalas e limitações;
- devolve erros previsíveis de forma estruturada;
- tem testes de parâmetros, contrato e regressão;
- inclui pelo menos um caso de referência documentado;
- apresenta atribuição e disclaimer na interface;
- declara o nível real de validação;
- não expõe credenciais ou dados sensíveis;
- o PR foi revisto por uma pessoa responsável pelo método.

## Uso de inteligência artificial

IA pode apoiar pesquisa, decomposição, implementação, testes, revisão e
documentação. O PR deve indicar onde foi utilizada e como o resultado foi
verificado. A declaração não transfere responsabilidade: a pessoa que aprova o
merge continua responsável pela adequação científica e operacional.
