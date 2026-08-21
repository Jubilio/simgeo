## Objetivo

Descreva uma única mudança verificável e por que ela é necessária.

## Alterações

- [descreva a alteração]

## Validação executada

- [ ] Registo científico: `python scripts/validate_scientific_specs.py`
- [ ] Testes do validador: `python -m unittest scripts.tests.test_validate_scientific_specs`
- [ ] Django: `python manage.py test`
- [ ] Frontend: `npm run lint && npm run build`
- [ ] Caso real/de referência verificado, quando aplicável

## Revisão científica e geoespacial

- [ ] Pergunta, decisão apoiada e usos proibidos estão explícitos
- [ ] Fontes, versões, períodos, CRS, escalas, unidades e limiares estão documentados
- [ ] Resolução nominal não é apresentada como precisão efetiva
- [ ] Hazard, exposure, vulnerability, impact e contexto não são confundidos
- [ ] Fallbacks, valores ausentes e resultados parciais são visíveis
- [ ] Foi acrescentado teste de regressão para cada bug corrigido
- [ ] A interface e a API apresentam limitações coerentes com a metodologia

## Risco e reversão

Indique efeitos possíveis, dependências externas e como reverter com segurança.

## Assistência por IA

- [ ] Não utilizada
- [ ] Utilizada — descreva ferramenta/tarefa e como o resultado foi revisto e validado

## Revisão humana

- [ ] O código foi lido e compreendido por quem solicita o merge
- [ ] Uma pessoa responsável confirmou a adequação metodológica
