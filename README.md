# SimGeo (GeoRiskSim) 🌍📊

**SimGeo** é um Sistema de Apoio à Decisão Espacial (Spatial Decision Support System - SDSS) projetado para agências humanitárias, governos e ONGs. O objetivo principal da plataforma é simular cenários multi-risco (cheias, ciclones, secas) e intersecionar esses dados com índices socioeconómicos, de vulnerabilidade e exposição de infraestruturas críticas.

## 🎯 Objetivo
Permitir a criação de cenários *what-if* para responder a questões operacionais críticas antes, durante e após desastres naturais, tais como:
> *"Se um ciclone de Categoria 4 atingir Sofala, qual a percentagem da população em situação de pobreza afetada e quais as escolas que ficarão isoladas?"*

## 🏗 Arquitetura do Sistema

O sistema é construído sobre uma arquitetura moderna e open-source orientada a microserviços e dados geográficos:

- **Frontend**: React (Vite) + TailwindCSS v4 + React-Leaflet
- **Backend**: Python, Django, Django REST Framework (DRF)
- **Base de Dados Espacial**: PostgreSQL + PostGIS
- **Processamento Assíncrono**: Celery + Redis (Message Broker)
- **Processamento GIS Avançado (Planeado)**: GeoPandas, GDAL, Rasterio, Machine Learning (Scikit-learn/XGBoost).

## 🧩 Módulos Principais

1. **Gestão de Dados e Base de Dados Espacial**: Visualização e query de limites administrativos (Província, Distrito, Posto), Demografia e Infraestrutura Crítica (escolas, hospitais, estradas).
2. **Motor de Simulação de Cheias (Flood Engine)**: Simulação com base em precipitação, relevo (DEM), declive e rede de drenagem.
3. **Motor de Simulação de Ciclones (Cyclone Engine)**: Buffer de trajetórias, wind fields e impacto espacial.
4. **Módulo Analítico e de Vulnerabilidade**: Integração de índices de pobreza e segurança alimentar (IPC).
5. **Dashboard Multi-Risco**: Cálculo em tempo real: `Risco = Perigo (Hazard) × Exposição × Vulnerabilidade`.

---

## 🤝 Como Contribuir

Se acaba de se juntar ao projeto, seja bem-vindo! 
Para configurar o seu ambiente de desenvolvimento e começar a programar o SimGeo na sua máquina, leia atentamente o documento **[SETUP_GUIDE.md](SETUP_GUIDE.md)**.

## 📄 Licença
A definir (Open Source / MIT / Proprietária).
