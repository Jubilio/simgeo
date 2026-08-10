---
name: spatial-uploads
user-invocable: true
description: "Workspace skill para o processamento de carregamento de Shapefiles e GeoJSON via GDAL no SimGeo."
---

# Spatial Uploads Management

## Purpose

Esta skill documenta e rege o processo de gestão de ficheiros espaciais enviados pelo utilizador no ecossistema SimGeo. Como os Shapefiles exigem ficheiros dependentes (.dbf, .shx), existe um workflow rígido sobre como receber, armazenar e processar estes ficheiros.

## When to Use

- Ao debugar erros 400 ou 500 no endpoint `/api/upload/`.
- Ao adicionar suporte para novos formatos geoespaciais (ex: KML, GeoTIFF, PMTiles).
- Ao modificar o modelo `SpatialDataset` ou a interação do `GDAL DataSource` com a base de dados PostGIS.

## Workflow

1.  **Recepção no Django (`FileUploadView`)**:
    - Verificar se o ficheiro é `.zip` (para Shapefiles) ou `.geojson`.
    - Guardar o ficheiro no modelo `SpatialDataset` imediatamente (em `spatial_datasets/`) para retenção a longo prazo e download.

2.  **Processamento em Diretório Temporário**:
    - Extrair os ficheiros do ZIP num `tempfile.TemporaryDirectory()`.
    - Localizar o ficheiro `.shp`.
    - Usar `django.contrib.gis.gdal.DataSource` para abrir o `.shp`.

3.  **Mapeamento de Camadas (Features)**:
    - Iterar pela camada do `DataSource` (normalmente índice 0).
    - Mapear atributos dependendo do `layer_type` (`infrastructure` ou `boundary`).
    - Converter o `feature.geom` para WKT e injetar via GEOSGeometry.

## Quality Criteria

- Nunca processar um Shapefile isolado (`.shp`) sem exigir que o utilizador envie o pacote compactado (`.zip`).
- Ficheiros são guardados no `SpatialDataset` de forma segura.
- Quaisquer exceções no `DataSource` devolvem um erro legível 400, e não um 500.

## Example Prompts

- `Verifica a lógica de extração GDAL usando a skill spatial-uploads.`
- `Adiciona suporte para carregar ficheiros GeoTIFF conforme as normas do spatial-uploads.`
