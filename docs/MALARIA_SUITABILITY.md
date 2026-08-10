# Aptidão Ambiental para a Malária em Moçambique

O módulo produz um **Índice de Aptidão Ambiental para a Malária** entre 0 e 1 para Moçambique. O índice identifica locais onde as condições ambientais podem favorecer a sobrevivência e reprodução de mosquitos vetores. Ele **não estima casos, incidência, prevalência ou mortalidade por malária**.

## Dados utilizados

| Componente | Google Earth Engine | Papel no índice | Peso |
|---|---|---|---:|
| Temperatura média da superfície (dia/noite) | [`MODIS/061/MOD11A2`](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD11A2) | Janela térmica favorável, com redução nos extremos | 30% |
| Precipitação | [`UCSB-CHG/CHIRPS/DAILY`](https://developers.google.com/earth-engine/datasets/catalog/UCSB-CHG_CHIRPS_DAILY) | Disponibilidade de água para habitats larvares | 25% |
| Água superficial | [`JRC/GSW1_4/GlobalSurfaceWater`](https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_GlobalSurfaceWater) | Ocorrência histórica de água superficial | 20% |
| Vegetação | [`MODIS/061/MOD13Q1`](https://developers.google.com/earth-engine/datasets/catalog/MODIS_061_MOD13Q1) | Proxy de humidade e cobertura vegetal | 15% |
| Elevação | [`USGS/SRTMGL1_003`](https://developers.google.com/earth-engine/datasets/catalog/USGS_SRTMGL1_003) | Proxy secundário de condições térmicas e hidrológicas | 10% |

O período predefinido é 2020–2025. O utilizador pode produzir uma superfície anual ou uma climatologia mensal. A resolução efetiva da informação é de aproximadamente 5,5 km, determinada pelo CHIRPS; a visualização não deve ser interpretada como tendo maior precisão apenas porque os tiles permitem mais zoom.

## Normalização

Cada componente é convertido para uma pontuação de 0 a 1:

- **Temperatura:** aumenta entre 18–22 °C, permanece máxima entre 22–30 °C e diminui entre 30–34 °C.
- **Precipitação:** usa uma resposta trapezoidal. A aptidão mensal aumenta entre 20–80 mm, permanece máxima entre 80–250 mm e diminui entre 250–500 mm. Para a camada anual, o total médio anual é convertido num equivalente mensal antes da pontuação.
- **Água superficial:** ocorrência JRC dividida por 100.
- **Vegetação:** NDVI aumenta linearmente entre 0,15 e 0,50 e depois satura.
- **Elevação:** diminui linearmente de 1 a 0 entre 0 e 1.500 metros.

O índice final é:

```text
0,30 × temperatura + 0,25 × precipitação + 0,20 × água
+ 0,15 × vegetação + 0,10 × elevação
```

## API

```http
GET /api/simulation/gee/malaria-suitability/?start_year=2020&end_year=2025&month=0
```

`month=0` produz o índice anual; valores de 1 a 12 produzem uma climatologia para o mês selecionado.

A resposta inclui `tile_url` para o mapa e metadados sobre período, pesos, fontes, legenda e limitações.

## Interpretação responsável

O produto deve ser utilizado para triagem ambiental, seleção de áreas para estudos de campo e apoio à estratificação. Antes de orientar recursos ou intervenções, deve ser validado e combinado com:

- casos confirmados e testagem;
- prevalência parasitária;
- vigilância entomológica e distribuição das espécies vetoras;
- população, mobilidade e deslocamentos;
- cobertura de redes mosquiteiras e pulverização intradomiciliária;
- qualidade da habitação, acesso aos cuidados e disponibilidade de diagnóstico e tratamento.

## Limitações

- Temperatura da superfície não é igual à temperatura do ar sentida pelo vetor.
- O JRC não representa adequadamente todos os pequenos habitats temporários.
- A água superficial é uma camada histórica fixa de 1984–2021; o seletor temporal altera temperatura, precipitação e vegetação, mas não altera água superficial nem elevação.
- Relações ambientais variam entre espécies, estações e regiões ecológicas.
- Os pesos são transparentes, mas ainda precisam de validação local e análise de sensibilidade.
- A média de vários anos descreve aptidão climática; não funciona como alerta precoce em tempo real.
