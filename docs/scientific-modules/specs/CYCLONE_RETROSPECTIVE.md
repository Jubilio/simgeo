# Análise retrospetiva de ciclones

## Pergunta científica e decisão

O módulo representa precipitação acumulada ou o máximo horário da velocidade
do vento a 10 m num intervalo histórico. Apoia contextualização e triagem de
áreas; não prevê trajetória, categoria ou rajadas locais.

## Dados e versões

- `NASA/GPM_L3/IMERG_V07`: precipitação por satélite.
- `ECMWF/ERA5_LAND/HOURLY`: componentes horárias do vento a 10 m.

## Unidade espacial e temporal

O intervalo máximo é de 30 dias e é recortado a Moçambique. A resolução efetiva
depende do produto selecionado e deve acompanhar os metadados e a legenda.

## Método

Para chuva, o serviço acumula a precipitação IMERG no intervalo. Para vento,
calcula a magnitude a partir das componentes a 10 m e retém o máximo horário.
Esses produtos descrevem condições ambientais reconstruídas, não a intensidade
oficial de um ciclone num ponto.

## Contrato da API

`POST /api/simulation/gee/cyclone/` exige datas ISO e `type=rain|wind`.
Parâmetros inválidos devolvem `400`; indisponibilidade de processamento deve
ser distinguida de erro do utilizador.

## Validação

Nível atual: **V1**. Há testes de tipo, datas, ordem e duração. Falta caso de
referência comparado com relatório oficial do INAM/IBTrACS ou outra fonte
independente.

## Limitações e uso responsável

- ERA5-Land é reanálise em grelha e não mede rajadas máximas locais.
- IMERG contém incerteza de estimativa, sobretudo em janelas curtas.
- O módulo não calcula trajetória, raio de vento, exposição ou impacto.

## Proveniência e IA

Qualquer alteração de acumulação, unidade ou composição vetorial precisa de
teste numérico e revisão humana antes do merge.
