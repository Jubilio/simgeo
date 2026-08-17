# SimGeo (GeoRiskSim) 🌍📊

**SimGeo** é um Sistema de Apoio à Decisão Espacial (Spatial Decision Support System - SDSS) projetado para agências humanitárias, governos e ONGs. O objetivo principal da plataforma é simular cenários multi-risco (cheias, ciclones, secas) e intersecionar esses dados com índices socioeconómicos, de vulnerabilidade e exposição de infraestruturas críticas.

## 🎯 Objetivo
Permitir a criação de cenários *what-if* para responder a questões operacionais críticas antes, durante e após desastres naturais, tais como:
> *"Se um ciclone de Categoria 4 atingir Sofala, qual a percentagem da população em situação de pobreza afetada e quais as escolas que ficarão isoladas?"*

## 🏗 Arquitetura do Sistema

O sistema é construído sobre uma arquitetura moderna e open-source orientada a microserviços e dados geográficos:

- **Frontend**: React (Vite) + TailwindCSS v4 + Deck.gl
- **Backend**: Python, Django, Django REST Framework (DRF)
- **Base de Dados Espacial**: PostgreSQL + PostGIS
- **Processamento Assíncrono**: Celery + Redis (Message Broker)
- **Processamento GIS Avançado (Planeado)**: GeoPandas, GDAL, Rasterio, Machine Learning (Scikit-learn/XGBoost).

## 🧩 Módulos Principais

1. **Gestão de Dados e Base de Dados Espacial**: Visualização e query de limites administrativos (Província, Distrito, Posto), Demografia e Infraestrutura Crítica (escolas, hospitais, estradas).
2. **Motor de Cheias (Flood Engine)**: Triagem de hazard com profundidade GLOFAS por período de retorno ou deteção de evento Sentinel-1, cruzada com população e agricultura expostas.
3. **Módulo de Ciclones**: Visualização retrospetiva da precipitação acumulada GPM IMERG e do máximo horário do vento a 10 m no ERA5-Land.
4. **Módulo Analítico e de Vulnerabilidade**: Integração de índices de pobreza e segurança alimentar (IPC).
5. **Dashboard Multi-Risco**: Cálculo em tempo real: `Risco = Perigo (Hazard) × Exposição × Vulnerabilidade`.
6. **Aptidão Ambiental para a Malária (Moçambique)**: Índice anual ou mensal no Google Earth Engine, combinando temperatura, precipitação, água superficial, vegetação e elevação. O produto representa aptidão ambiental e não carga da doença. Consulte a [metodologia e limitações](docs/MALARIA_SUITABILITY.md).
7. **Dinâmica Florestal**: Monitorização anual da cobertura arbórea com Dynamic World, distinguindo estoque, saldo líquido, ganhos/perdas brutos e transições entre classes. Consulte a [metodologia e interpretação](docs/FOREST_DYNAMICS.md).
8. **Perfil Humano Admin1/Admin2**: indicadores demográficos OCHA 2025 e mobilidade DTM R22 associados por P-code, com perfis provinciais/distritais, mapas temáticos e alocação demográfica indicativa da população exposta a cheias.
9. **Google Flood Forecasting**: alertas fluviais, cheias rápidas e eventos significativos em tempo real, com polígonos convertidos para GeoJSON, contexto Admin1/Admin2 e contingência para o Flood Hub. Consulte a [configuração e as limitações](docs/GOOGLE_FLOOD_FORECASTING.md).

---

## ✨ Novas Funcionalidades

### 👥 Perfil humano OCHA por P-code

O endpoint `GET /api/simulation/admin-baseline/` entrega indicadores de demografia e mobilidade para 11 províncias e 159 distritos. Use `level=1|2`, `indicator=<chave>` e `include_map=true` para solicitar também a camada temática GEE. A API continua a devolver os perfis se o serviço cartográfico estiver indisponível.

Os dados normalizados estão em `simulation/data/ocha_baseline_2025.json`. Para os regenerar a partir da fonte:

```bash
pip install -r scripts/requirements-baseline.txt
python scripts/build_ocha_baseline.py \
  OCHA_Mozambique_Baseline_Data_2025_HNO_20240815.xlsx \
  simulation/data/ocha_baseline_2025.json
```

Valores ausentes permanecem nulos. O indicador de pessoas com deficiência é uma estimativa de planeamento de 15%, e o caseload DTM combina IDPs e retornados disponíveis; nenhum dos dois deve ser interpretado como observação individual ou deslocamento ativo. As tabelas são associadas por P-code; enquanto a geometria OCHA COD não estiver no projeto, a camada GAUL 2015 usa uma correspondência auditável por nome normalizado e informa as áreas não associadas.

### 🌊 Previsões Google Floods

Os endpoints `GET /api/simulation/google-floods/status/` e `GET /api/simulation/google-floods/forecast/` mantêm a API key exclusivamente no Django. Quando o acesso oficial ainda não está aprovado, o painel continua útil ao abrir o Flood Hub na posição atual do mapa. Quando a API está ativa, o SimGeo mostra previsões e geometrias e cruza-as, quando disponível, com limites PostGIS, perfis OCHA e infraestruturas locais.

Este produto é apoio à decisão e alerta precoce. Não substitui avisos oficiais do INGD/INAM, modelação hidráulica local nem verificação de campo. Veja [Google Flood Forecasting no SimGeo](docs/GOOGLE_FLOOD_FORECASTING.md).

### 🤖 Protótipo do Assistente IA
O frontend inclui uma interface conversacional e o backend devolve respostas e ações cartográficas demonstrativas, como centrar o mapa ou criar um buffer. A ligação a um LLM e as consultas contextuais ao PostGIS permanecem planeadas; o módulo atual não deve ser apresentado como um assistente analítico operacional.

Para mais detalhes, consulte [simgeo-chatbot skill](.github/skills/simgeo-chatbot/SKILL.md).

### 📁 Processamento de Uploads Espaciais
Importação de infraestruturas geográficas personalizadas com suporte GDAL:
- **Formatos Suportados**: Shapefiles (`.zip`), GeoJSON (`.geojson`)
- **Processamento Seguro**: limites de tamanho, bloqueio de path traversal e validação dos componentes do Shapefile
- **Integração PostGIS**: Conversão automática de geometrias para a base de dados spatial
- **Mapeamento de Camadas**: nesta versão, apenas infraestruturas
- **Gestão de Ficheiros**: Retenção a longo prazo para auditoria e download

Para mais detalhes, consulte [spatial-uploads skill](.github/skills/spatial-uploads/SKILL.md).

---

## 🤝 Como Contribuir

Se acaba de se juntar ao projeto, seja bem-vindo! 
Para configurar o seu ambiente de desenvolvimento e começar a programar o SimGeo na sua máquina, leia atentamente o documento **[SETUP_GUIDE.md](SETUP_GUIDE.md)**.

## 📄 Licença
A definir (Open Source / MIT / Proprietária).
