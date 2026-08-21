# Arquitetura do SimGeo

## Visão geral

O SimGeo é um sistema de apoio à decisão espacial. A interface React solicita
cenários ao Django REST Framework; o backend valida parâmetros, consulta
PostGIS ou serviços externos e devolve geometrias, estatísticas, metadados e
URLs temporárias de tiles.

```text
React + Deck.gl/MapLibre
        |
        v
Django REST API ---- PostGIS
        |
        +---- Google Earth Engine
        +---- Google Flood Forecasting
        +---- Redis/Cache e Celery
```

## Limites de responsabilidade

| Componente | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| Frontend | recolher o cenário, representar o mapa, explicar o resultado | armazenar chaves ou recalcular metodologia científica |
| API | autenticar, validar, normalizar respostas e erros | aceitar parâmetros não validados |
| Serviço científico | implementar datasets, equações, escalas e metadados | depender de estado da interface |
| PostGIS | limites, infraestrutura e joins espaciais persistentes | substituir fontes oficiais sem proveniência |
| Earth Engine | processamento raster e tiles temporários | ser tratado como serviço sem timeout ou quota |
| Registo científico | descrever método, evidência e limitações | substituir testes ou revisão humana |

## Fluxo de um módulo científico

1. O painel envia apenas parâmetros documentados.
2. A view converte falhas de validação em `400` e indisponibilidade externa em
   `503` com mensagem utilizável.
3. O serviço escolhe fontes e escala, executa o processamento e devolve
   resultados acompanhados de metadados.
4. A interface apresenta unidade, período, fonte, nível de validação e
   disclaimer.
5. Logs internos preservam detalhes técnicos; respostas públicas nunca expõem
   credenciais.

## Convenções geoespaciais

- Coordenadas de entrada e GeoJSON usam longitude/latitude em `EPSG:4326`.
- Cálculo de área raster usa `ee.Image.pixelArea()` e converte explicitamente
  para hectares ou km².
- Dados categóricos usam vizinho mais próximo; interpolação não pode criar
  classes inexistentes.
- Resolução nominal, escala de redução e precisão de visualização são conceitos
  diferentes e devem aparecer nos metadados.
- Joins administrativos preferem P-code. Correspondência por nome normalizado
  deve informar não correspondências e ambiguidades.
- Resultados nacionais interativos podem usar agregação e fallback de escala,
  mas a escala efetivamente usada deve ser devolvida.

## Contrato mínimo de resultados

Um resultado científico deve disponibilizar, quando aplicável:

- `status` e dados do cenário;
- fontes e versões;
- período e unidade temporal;
- CRS e escala efetiva;
- unidades dos indicadores;
- legenda e URL de tiles;
- limitações ou disclaimer;
- nível de validação;
- mensagens sobre fallback ou resultado parcial.

## Documentos relacionados

- [Scientific Development Framework](SCIENTIFIC_DEVELOPMENT_FRAMEWORK.md)
- [Decisões técnicas e científicas](DECISIONS.md)
- [Problemas conhecidos](KNOWN_ISSUES.md)
- [Registo de módulos](scientific-modules/registry.json)
