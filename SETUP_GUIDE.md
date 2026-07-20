# Guia de Configuração e Onboarding (SimGeo) 🚀

Olá! Bem-vindo(a) à equipa de desenvolvimento do **SimGeo**.
Como o nosso sistema utiliza Processamento Espacial (GIS) avançado, a configuração inicial requer algumas ferramentas específicas, especialmente se estiveres a usar **Windows**. Segue os passos abaixo cuidadosamente.

---

## 🛠️ 1. Requisitos Necessários (Ferramentas a Instalar)

Antes de copiares o código, precisas ter os seguintes programas instalados no teu computador:

1. **Docker Desktop**: Necessário para correr a base de dados espacial (PostgreSQL+PostGIS) e o Redis sem precisares de instalar e configurar tudo manualmente no teu SO.
   - [Download Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. **Python 3.10+**: Linguagem do backend.
   - [Download Python](https://www.python.org/downloads/)
3. **Node.js (LTS)**: Necessário para correr e compilar o frontend (React/Vite).
   - [Download Node.js](https://nodejs.org/)
4. **Git**: Para controlo de versões.
5. ⚠️ **OSGeo4W (Crucial para Windows)**: O framework GeoDjango precisa das bibliotecas C++ de mapas (GDAL e GEOS). No Windows, a forma mais fácil é instalá-las via OSGeo4W ou usando o QGIS.
   - **Opção A**: Se tens o [QGIS](https://qgis.org/) instalado, as bibliotecas já lá estão (ex: `C:\Program Files\QGIS 3.xx\bin`).
   - **Opção B**: Descarrega e instala o [OSGeo4W Network Installer](https://trac.osgeo.org/osgeo4w/). Instala o pacote padrão (`Express Desktop Install` -> `GDAL`). 

---

## 🏗️ 2. Levantar a Infraestrutura (Docker)

O projeto usa contentores para facilitar a vida. A base de dados PostgreSQL já vem com a extensão PostGIS instalada.

1. Abre um terminal na raiz do projeto (`SimGeo/`).
2. Garante que tens o Docker Desktop aberto a correr.
3. Executa:
   ```bash
   docker compose up -d
   ```
4. Isto vai criar 3 serviços:
   - `simgeo_postgis` (Base de dados na porta **5433** - *usamos a 5433 para evitar conflitos com outros Postgres locais*).
   - `simgeo_redis` (Fila de tarefas na porta 6379).
   - `simgeo_pgadmin` (Interface visual de BD em `http://localhost:5050`).

---

## 🐍 3. Configurar o Backend (Django / Python)

O nosso Backend utiliza o framework GeoDjango.

1. Abre o terminal na raiz do projeto.
2. Cria e ativa o teu ambiente virtual:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate
   
   # Mac/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Instala as dependências Python:
   ```bash
   pip install -r requirements.txt
   ```
4. Copia o ficheiro de configuração de ambiente:
   - Copia o ficheiro `.env.example` e dá-lhe o nome `.env`.
   - **PASSO CRÍTICO (WINDOWS)**: Abre o `.env` e configura os caminhos do `GDAL` e `GEOS` de acordo com a tua instalação. Se usaste o OSGeo4W por defeito será:
     ```env
     GDAL_LIBRARY_PATH=C:/OSGeo4W/bin/gdal310.dll  # Verifica a versão (pode ser gdal309, etc)
     GEOS_LIBRARY_PATH=C:/OSGeo4W/bin/geos_c.dll
     ```
5. Executa as migrações (criar tabelas no PostGIS):
   ```bash
   python manage.py migrate
   ```
6. Inicia o servidor:
   ```bash
   python manage.py runserver 8000
   ```
O backend ficará disponível em: [http://localhost:8000/api/](http://localhost:8000/api/)

---

## ⚛️ 4. Configurar o Frontend (React / Vite)

O frontend foi construído de forma rápida e moderna com React e TailwindCSS v4.

1. Abre **um novo terminal** e entra na pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instala os pacotes Node:
   ```bash
   npm install
   ```
3. Inicia o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
O frontend ficará disponível em: [http://localhost:5173/](http://localhost:5173/)

---

## 🐛 Resolução de Problemas Frequentes (Troubleshooting)

**1. Erro: `ImproperlyConfigured: Could not find the GDAL library` ao correr o migrate.**
> Isso significa que o Django não consegue encontrar o GDAL no teu Windows. Verifica se os caminhos `GDAL_LIBRARY_PATH` e `GEOS_LIBRARY_PATH` no teu `.env` estão absolutamente corretos e apontam para os `.dll` existentes no teu disco (ex: via QGIS ou OSGeo4W).

**2. Erro de password / Conexão no PostGIS / Docker.**
> Certifica-te de que o teu ficheiro `.env` tem `DB_HOST=127.0.0.1` (evita usar `localhost` se der erro de IPv6 `::1`) e que a porta é a `5433` (`DB_PORT=5433`).

Bom trabalho e qualquer dúvida entra em contacto! 💻🗺️
