# Google Flood Forecasting no SimGeo

Este módulo acrescenta previsões operacionais do **Google Flood Forecasting** sem substituir a análise de impacto já existente com GLOFAS/Sentinel-1.

## O que entra no SimGeo

- estados fluviais ativos em Moçambique, com severidade, tendência, período de previsão e estado de verificação de qualidade;
- cheias rápidas previstas, incluindo as zonas `LIKELY` e `HIGHLY_LIKELY` quando a API fornece os polígonos;
- eventos significativos, com população e área afetada estimadas pelo fornecedor;
- polígonos KML convertidos para GeoJSON no Django;
- interseção espacial opcional com Admin1/Admin2 e infraestruturas do PostGIS;
- associação dos Admin1/Admin2 aos perfis OCHA por P-code ou nome normalizado;
- link de contingência para abrir a posição atual do mapa no Flood Hub.

Os totais OCHA do contexto administrativo representam a população residente das áreas intersectadas. **Não são uma estimativa de pessoas afetadas.** Para exposição raster de população e agricultura, continue a usar o módulo **Impacto de cheias**.

## Configuração

O acesso à API oficial requer aprovação e uma API key num projeto Google Cloud. Depois de obter o acesso, defina as variáveis apenas no `.env` do backend:

```dotenv
GOOGLE_FLOOD_API_ENABLED=True
GOOGLE_FLOOD_API_KEY=sua-chave-servidor
GOOGLE_FLOOD_API_TIMEOUT_SECONDS=15
GOOGLE_FLOOD_API_CACHE_SECONDS=600
GOOGLE_FLOOD_API_MAX_POLYGONS=24
```

Recrie ou reinicie o serviço Django:

```bash
docker compose up -d --build api
```

Confirme o estado sem expor a chave:

```bash
curl http://localhost:8000/api/simulation/google-floods/status/
```

Com `ready: true`, consulte as previsões:

```bash
curl "http://localhost:8000/api/simulation/google-floods/forecast/?country=MZ&include_polygons=true&include_context=true"
```

## Segurança e resiliência

- a chave nunca é enviada ao React e não existe variável `VITE_*` para ela;
- o backend autentica com o cabeçalho `X-Goog-Api-Key`;
- respostas são limitadas a 25 MB, têm timeout e cache configurável;
- a quantidade de polígonos é limitada para manter o pedido interativo;
- falhas parciais de um tipo de previsão não eliminam os restantes resultados;
- se Redis ou PostGIS estiverem indisponíveis, a consulta principal continua sempre que possível;
- sem chave ou aprovação, a interface usa o Flood Hub público como contingência.

Restrinja a API key no Google Cloud à Flood Forecasting API e aos ambientes de backend autorizados. Não faça commit da chave.

## Endpoints internos

| Endpoint SimGeo | Função |
| --- | --- |
| `GET /api/simulation/google-floods/status/` | Estado da configuração e URL de contingência |
| `GET /api/simulation/google-floods/forecast/` | Previsões normalizadas, GeoJSON e contexto local |

Parâmetros da previsão:

- `country=MZ`: código ISO alpha-2;
- `include_polygons=true|false`;
- `include_context=true|false`;
- `refresh=true|false`: ignora o cache do fornecedor nesta consulta.

## Fontes e atribuição

- [Flood Forecasting API](https://developers.google.com/flood-forecasting)
- [Referência RPC v1](https://developers.google.com/flood-forecasting/rpc/google.research.floodforecasting.v1)
- [Flood Hub](https://sites.research.google/floods/)

Dados Google Flood Forecasting sob **CC BY 4.0**. Mantenha a atribuição apresentada na interface e em produtos derivados.
