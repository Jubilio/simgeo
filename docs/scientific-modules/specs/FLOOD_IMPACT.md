# Impacto de cheias

## Pergunta científica e decisão

O módulo estima onde um cenário de inundação pode intersectar população
modelada e agricultura. É um instrumento de triagem; não estima danos,
necessidades, mortalidade ou perdas económicas.

## Dados e versões

| Papel | Dataset | Uso |
| --- | --- | --- |
| Perigo probabilístico | `JRC/CEMS_GLOFAS/FloodHazard/v2_1` | profundidade por período de retorno |
| Deteção de evento | `COPERNICUS/S1_GRD` | mudança do retroespalhamento VH |
| População | `WorldPop/GP/100m/pop`, 2020 MOZ | exposição populacional modelada |
| Agricultura | `ESA/WorldCover/v100`, 2020 | fração de cropland |

## Unidade espacial e temporal

O cenário GLOFAS é estático por período de retorno. Sentinel-1 aceita um
intervalo de evento de até 30 dias. A redução nacional usa `EPSG:4326` e uma
grelha de 1000 m, com fallback explícito a 2500 m quando a computação excede o
prazo interativo.

## Método

GLOFAS considera inundado o pixel com profundidade superior a 0,15 m e remove
água permanente. Sentinel-1 identifica retornos pós-evento inferiores a -18 dB
que eram superiores a -16 dB antes do evento; estes limiares são apenas de
screening e requerem calibração local.

Perigo, densidade populacional e fração agrícola são agregados antes da redução
nacional. População exposta é densidade × fração inundada × área do pixel;
agricultura exposta é fração agrícola × fração inundada × área do pixel.

## Contrato da API

`POST /api/simulation/gee/flood-impact/` aceita `engine=glofas` com período de
retorno suportado ou `engine=sentinel1` com datas. Parâmetros inválidos devolvem
`400`; timeout/indisponibilidade externa devolve `503`. A resposta informa a
escala efetivamente usada.

## Validação

Nível atual: **V1**. Existem testes de parâmetros, intervalo temporal,
projeção portável, escalas de fallback e contrato da view. Falta executar e
fixar um caso real de referência com comparação independente de área e
exposição.

## Limitações e uso responsável

- GLOFAS não é uma simulação hidráulica local.
- Os limiares Sentinel-1 podem confundir sombra, solo húmido e água.
- WorldPop e WorldCover são modelos de 2020 e podem estar desatualizados.
- Exposição não equivale a população afetada nem vulnerabilidade.
- O fallback altera a granularidade e deve permanecer visível ao utilizador.

## Proveniência e IA

O serviço e esta ficha são mantidos no mesmo histórico Git. Mudanças de
dataset, limiar, CRS ou escala exigem atualização do registo, teste de regressão
e revisão humana do método.
