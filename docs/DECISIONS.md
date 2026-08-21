# Decisões técnicas e científicas

Este ficheiro guarda decisões que afetam mais de um módulo. Alterações devem
ser acrescentadas como uma nova decisão; não se deve apagar o motivo histórico.

## ADR-001 — Registo científico versionado

- **Estado:** aceite
- **Data:** 2026-08-21
- **Decisão:** todo novo simulador ou índice deve ter uma ficha metodológica e
  uma entrada em `docs/scientific-modules/registry.json`.
- **Motivo:** permitir auditoria automática de fontes, escalas, limitações e
  estado de validação.
- **Consequência:** mudanças metodológicas passam a alterar código e registo no
  mesmo PR.

## ADR-002 — CRS portável e área geodésica no Earth Engine

- **Estado:** aceite
- **Data:** 2026-08-14
- **Decisão:** usar `EPSG:4326` nas reduções interativas e
  `ee.Image.pixelArea()` para área real; evitar WKT personalizado em
  `ee.Projection()`.
- **Motivo:** definições WKT provocaram erros de parser e respostas `500/503`.
- **Consequência:** a escala é declarada em metros e a área é convertida
  explicitamente para hectares ou km².

## ADR-003 — Orçamento de computação e fallback explícito

- **Estado:** aceite
- **Data:** 2026-08-14
- **Decisão:** análises nacionais síncronas devem agregar antes de
  `reduceRegion`, limitar pixels/tile scale e, quando metodologicamente
  aceitável, tentar uma escala secundária mais grossa.
- **Motivo:** reduções nacionais em resolução nativa excederam o prazo
  interativo do Earth Engine.
- **Consequência:** a resposta informa a escala realmente utilizada; o fallback
  nunca pode ser silencioso.

## ADR-004 — Separar suitability, hazard, exposure e impact

- **Estado:** aceite
- **Data:** 2026-08-21
- **Decisão:** nomes, API e interface devem distinguir aptidão ambiental,
  perigo, exposição, vulnerabilidade e impacto.
- **Motivo:** esses produtos respondem perguntas diferentes e não são
  intercambiáveis.
- **Consequência:** o índice de malária não representa casos; totais OCHA numa
  área intersectada não representam pessoas afetadas; produtos de pecuária
  modelada não representam um censo.

## ADR-005 — Credenciais apenas no backend

- **Estado:** aceite
- **Data:** 2026-08-14
- **Decisão:** chaves de APIs externas são configuradas no Django e nunca em
  variáveis `VITE_*` ou respostas públicas.
- **Motivo:** aplicações web não conseguem manter um segredo no cliente.
- **Consequência:** endpoints de estado podem informar disponibilidade, mas não
  devolver a chave ou detalhes sensíveis.
