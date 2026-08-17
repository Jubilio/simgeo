# Dinâmica Pecuária e Pastagens

O módulo combina os produtos anuais do **Global Pasture Watch (GPW)** com os
limites FAO GAUL e o perfil humano OCHA já disponível no SimGeo.

## Fontes

- [Efetivo pecuário FAOSTAT-adjusted](https://developers.google.com/earth-engine/datasets/catalog/projects_global-pasture-watch_assets_gld-1km_v1_livestock-headcount-faostat_m): `projects/global-pasture-watch/assets/gld-1km/v1/livestock-headcount-faostat_m`
- [Classes de pastagem](https://developers.google.com/earth-engine/datasets/catalog/projects_global-pasture-watch_assets_ggc-30m_v1_grassland_c): `projects/global-pasture-watch/assets/ggc-30m/v1/grassland_c`
- Limites administrativos: `FAO/GAUL/2015/level1` e `level2`
- Contexto humano: OCHA Mozambique Baseline Data 2025 HNO

Os produtos GPW estão licenciados sob **CC BY 4.0**. A interface atribui a
fonte ao Global Pasture Watch / Land & Carbon Lab.

## API

`GET /api/simulation/gee/livestock-dynamics/` devolve anos, espécies, modos de
mapa e níveis administrativos suportados.

`POST /api/simulation/gee/livestock-dynamics/` executa a análise:

```json
{
  "start_year": 2015,
  "end_year": 2022,
  "species": "cattle",
  "admin_level": 1
}
```

Espécies: `cattle`, `buffalo`, `goat`, `sheep` e `horse`. O período suportado é
2000–2022. `admin_level` aceita `1` (províncias) ou `2` (distritos).

## Produtos devolvidos

- tiles de efetivo no ano final;
- variação absoluta entre os anos inicial e final;
- classe de pastagem cultivada ou natural/seminatural;
- estabilidade, perda e ganho de pastagem;
- pressão indicativa: efetivo estimado por km² de pastagem;
- série temporal nacional;
- ranking Admin1/Admin2;
- P-code, população e caseload DTM quando o nome administrativo encontra
  correspondência na base OCHA.

Para reduzir timeouts, as áreas de pastagem de 30 m são agregadas à grelha de
1 km do produto pecuário antes das estatísticas nacionais e administrativas.

## Interpretação

O efetivo pecuário é uma alocação modelada a 1 km e ajustada aos totais
nacionais FAOSTAT. Os pixels não representam rebanhos ou explorações
observadas. Os resultados Admin2, as mudanças anuais e o indicador de pressão
devem ser usados para triagem e planeamento, com validação por censos, serviços
distritais e levantamentos de campo.

O próprio catálogo GPW documenta possível subestimação parcial da extensão de
pastagens no Zimbabwe e em Moçambique. Por isso, o módulo não deve ser usado
isoladamente para determinar perdas de animais, selecionar agregados familiares
ou calcular compensações.
