# Dinâmica florestal

O módulo **Dinâmica Florestal** mede mudanças anuais de cobertura arbórea em
Moçambique, nas suas províncias ou num polígono GeoJSON. O processamento é executado no Google Earth
Engine e devolve uma camada para o mapa, indicadores, série temporal e os
principais fluxos entre classes de uso/cobertura.

## Fonte e período

- Dataset: `GOOGLE/DYNAMICWORLD/V1`.
- Classe analisada: `trees` (valor 1).
- Período suportado: 2016 até ao último ano completo.
- Janela máxima: 10 anos.
- Composto anual: moda da classe mais provável, com pelo menos três
  observações válidas por pixel.
- Comparação: apenas pixels com dados válidos em todos os anos selecionados.

O Dynamic World tem resolução nominal de 10 m e é derivado do Sentinel-2. A
classe `trees` inclui floresta primária, floresta secundária e plantações; por
isso, os resultados representam **cobertura arbórea**, não uma classificação
oficial de floresta natural.

## Produtos

- cobertura arbórea inicial e final, em hectares;
- cobertura estável;
- ganho e perda brutos;
- saldo líquido e variação percentual;
- série anual de cobertura arbórea;
- destino da cobertura perdida;
- origem da cobertura regenerada;
- mapa de floresta estável, perda e ganho.

O saldo líquido (`final - inicial`) e o fluxo bruto (`ganho + perda`) são
apresentados separadamente. Áreas com saldo semelhante podem ter níveis de
transformação interna muito diferentes.

## Escala de cálculo

Os tiles são visualizados à resolução nominal de 10 m. Para manter a análise
interativa, as estatísticas são calculadas em `EPSG:6933` a:

- 250 m para Moçambique inteiro;
- 100 m para uma província;
- 30 m para uma área GeoJSON personalizada.

Essa diferença é mostrada na interface e nos metadados da resposta.
Como o produto é categórico, a avaliação estatística utiliza vizinho mais
próximo e nunca interpolação bilinear, evitando a criação de classes inválidas.

## API

Listar províncias:

```http
GET /api/simulation/gee/forest-dynamics/?scope=province
```

Executar a análise:

```http
POST /api/simulation/gee/forest-dynamics/
Content-Type: application/json

{
  "start_year": 2016,
  "end_year": 2025,
  "scope": "province",
  "area_name": "Cabo Delgado"
}
```

Para o país inteiro, use `"scope": "country"` e omita `area_name`.

Para uma unidade de conservação ou outra área personalizada em Moçambique, use
`"scope": "custom"` e envie um `Polygon`, `MultiPolygon`, `Feature` ou
`FeatureCollection` no campo `geometry`. Geometrias personalizadas são
limitadas a 20.000 vértices; ficheiros mais detalhados devem ser simplificados
antes do envio. A geometria é recortada ao território de Moçambique e deve
intersectá-lo.

## Interpretação

O produto é indicado para triagem, monitorização e priorização de áreas para
investigação. Mudanças detectadas devem ser verificadas por interpretação
visual, dados locais ou trabalho de campo antes de serem tratadas como
desmatamento ou restauração confirmados.
