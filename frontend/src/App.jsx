import { useEffect, useMemo, useState, useRef } from 'react';
import axios from 'axios';
import DeckGL from '@deck.gl/react';
import { _GlobeView as GlobeView, MapView } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import * as turf from '@turf/turf';
import useMapLayers from './components/MapLayers';
import useGEELayer from './components/GEELayer';
import { AdminBoundaryPanel } from './components/AdminBoundaryPanel';
import useAdminBoundaryLayers from './hooks/useAdminBoundaryLayers';
import CyclonePanel from './components/CyclonePanel';
import FloodImpactPanel from './components/FloodImpactPanel';
import ForestDynamicsPanel from './components/ForestDynamicsPanel';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

import { API_BASE_URL } from './config';

const MALARIA_MONTHS = [
  'Anual', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const MALARIA_MAX_YEAR = new Date().getFullYear() - 1;
const MALARIA_YEARS = Array.from(
  { length: MALARIA_MAX_YEAR - 2000 },
  (_, index) => MALARIA_MAX_YEAR - index
);

const INITIAL_VIEW_STATE = {
  longitude: 34.84,
  latitude: -19.83,
  zoom: 1.5,
  bearing: 0
};
const DEFAULT_BUFFER_RADIUS_KM = 5;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  // Estado do Chatbot (Assistente IA)
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Olá! Sou o Assistente de Inteligência Artificial do SimGeo. Como o posso ajudar hoje com as suas análises espaciais?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  
  // Estado das camadas do mapa
  const [showInfrastructure, setShowInfrastructure] = useState(false);
  
  // Estado da Simulação GEE
  const [simGEEFlood, setSimGEEFlood] = useState(false);
  const [showLULC, setShowLULC] = useState(false);
  const [showLithology, setShowLithology] = useState(false);
  const [lithologyType, setLithologyType] = useState('kaolinite');
  
  // Águas Subterrâneas (GLDAS)
  const [showGroundwater, setShowGroundwater] = useState(false);
  const [gwYear, setGwYear] = useState(2023);
  const [gwMonth, setGwMonth] = useState(5);
  const [gwModalOpen, setGwModalOpen] = useState(false);
  const [gwLoading, setGwLoading] = useState(false);
  const [gwData, setGwData] = useState([]);
  const [gwCustomPoints, setGwCustomPoints] = useState([]);

  // Aptidão Ambiental para a Malária
  const [showMalaria, setShowMalaria] = useState(false);
  const [malariaStartYear, setMalariaStartYear] = useState(2020);
  const [malariaEndYear, setMalariaEndYear] = useState(2025);
  const [malariaMonth, setMalariaMonth] = useState(0);

  // Simulação de Ciclones
  const [showCyclonePanel, setShowCyclonePanel] = useState(false);
  const [activeCyclone, setActiveCyclone] = useState(false);
  const [cycloneStart, setCycloneStart] = useState('2019-03-14'); // Idai defaults
  const [cycloneEnd, setCycloneEnd] = useState('2019-03-16');
  const [cycloneLayerType, setCycloneLayerType] = useState('rain');

  // Flood Impact Simulation
  const [showFloodImpactPanel, setShowFloodImpactPanel] = useState(false);
  const [floodEngine, setFloodEngine] = useState('glofas');
  const [floodReturnPeriod, setFloodReturnPeriod] = useState(100);
  const [floodS1Start, setFloodS1Start] = useState('2019-03-14');
  const [floodS1End, setFloodS1End] = useState('2019-03-16');
  const [floodImpactTileUrl, setFloodImpactTileUrl] = useState(null);
  const [floodStats, setFloodStats] = useState(null);
  const [floodLoading, setFloodLoading] = useState(false);

  // Dinâmica Florestal
  const [showForestDynamicsPanel, setShowForestDynamicsPanel] = useState(false);
  const [forestDynamicsResult, setForestDynamicsResult] = useState(null);
  const [forestLayerVisible, setForestLayerVisible] = useState(true);
  
  // Estado para Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const fileInputRef = useRef(null);
  
  // Barra de pesquisa
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  
  // Buffer Interativo (Turf.js)
  const [bufferData, setBufferData] = useState(null);
  const [showTerrain, setShowTerrain] = useState(true);
  
  const [waterLevel, setWaterLevel] = useState(2.0);
  const [geeError, setGeeError] = useState(null);

  // Limites Administrativos FAO GAUL
  const [adminActiveLevels, setAdminActiveLevels] = useState([]);
  const [adminNameFilter, setAdminNameFilter] = useState('');

  // Tooltip UI
  const [tooltipInfo, setTooltipInfo] = useState(null);

  useEffect(() => {
    // Tenta conectar à API do Django
    axios.get(API_BASE_URL)
      .then(() => {
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao conectar à API:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const vectorLayers = useMapLayers({
    showBoundaries: false,
    showInfrastructure,
    setTooltipInfo,
    gwCustomPoints,
    bufferData
  });

  const geeLayers = useGEELayer({
    activeFlood: simGEEFlood,
    waterLevel,
    activeLULC: showLULC,
    activeLithology: showLithology,
    lithologyType,
    activeGroundwater: showGroundwater,
    gwYear,
    gwMonth,
    activeMalaria: showMalaria,
    malariaStartYear,
    malariaEndYear,
    malariaMonth,
    activeCyclone,
    cycloneStart,
    cycloneEnd,
    cycloneLayerType,
    floodImpactTileUrl,
    forestDynamicsTileUrl: forestLayerVisible
      ? forestDynamicsResult?.gee_layer?.tile_url
      : null,
    setErrorMessage: setGeeError
  });

  const { layers: adminBoundaryLayers } = useAdminBoundaryLayers({
    activeLevels: adminActiveLevels,
    nameFilter: adminNameFilter,
    country: 'Mozambique',
    setErrorMessage: setGeeError,
  });

  // Função para buscar dados da série temporal GLDAS
  const fetchGwTimeSeries = async () => {
    setGwLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}simulation/gee/groundwater/timeseries/`, {
        start_date: "2018-01-01",
        end_date: "2023-12-31",
        points: gwCustomPoints.length > 0 ? gwCustomPoints : []
      });
      setGwData(response.data.timeseries);
    } catch (error) {
      console.error("Erro ao buscar série temporal:", error);
    } finally {
      setGwLoading(false);
    }
  };

  // Tratar cliques no mapa para seleção de pontos
  const handleMapClick = (info) => {
    if (showGroundwater && info.coordinate) {
      const [lng, lat] = info.coordinate;
      setGwCustomPoints(prev => {
        if (prev.length >= 5) return prev; // Max 5 pontos
        return [...prev, {
          name: `Ponto ${prev.length + 1}`,
          lng: parseFloat(lng.toFixed(4)),
          lat: parseFloat(lat.toFixed(4))
        }];
      });
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadSuccess(null);
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('layer_type', 'infrastructure');
    
    try {
      const res = await axios.post(`${API_BASE_URL}upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadSuccess(res.data.message);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadSuccess(null), 5000);
    } catch (err) {
      setUploadSuccess(`❌ ${err.response?.data?.error || 'Erro no upload'}`);
      setTimeout(() => setUploadSuccess(null), 5000);
    } finally {
      setUploading(false);
    }
  };

  // Pesquisa de infraestruturas
  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await axios.get(
        `${API_BASE_URL}infrastructures/?search=${encodeURIComponent(query)}`,
      );
      const data = res.data.features || res.data.results || res.data;
      // Filtra pelo nome
      const filtered = (Array.isArray(data) ? data : []).filter(f =>
        f.properties?.name?.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(filtered.slice(0, 8));
    } catch (err) {
      console.error('Erro na pesquisa:', err);
    }
  };
  
  // Criar Buffer com Turf.js
  const createBuffer = (lng, lat, radiusKm) => {
    const point = turf.point([lng, lat]);
    const buffered = turf.buffer(point, radiusKm, { units: 'kilometers' });
    setBufferData(buffered);
  };

  const updateFloodParameter = (setter, value) => {
    setter(value);
    setFloodImpactTileUrl(null);
    setFloodStats(null);
  };

  // Enviar Mensagem para o Assistente IA
  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}agent/chat/`, { message: userMessage });
      const data = res.data;
      
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      // Executar ações do agente no mapa
      if (data.action) {
        if (data.action.type === 'flyTo') {
          setViewState(prev => ({
            ...prev,
            longitude: data.action.coordinates[0],
            latitude: data.action.coordinates[1],
            zoom: data.action.zoom || 12,
            transitionDuration: 2000
          }));
        } else if (data.action.type === 'createBuffer') {
          createBuffer(data.action.coordinates[0], data.action.coordinates[1], data.action.radius);
        }
      }
    } catch (err) {
      console.error('Erro no assistente IA:', err);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Desculpe, ocorreu um erro ao contactar o servidor da IA.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Base Map Layer nativo do Deck.gl (Raster)
  const baseMapLayer = useMemo(() => new TileLayer({
    id: 'carto-basemap',
    data: 'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    minZoom: 0,
    maxZoom: 19,
    tileSize: 256,
    renderSubLayers: props => {
      const {
        bbox: { west, south, east, north }
      } = props.tile;

      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north]
      });
    }
  }), []);

  const activeLayerCount = [
    showInfrastructure,
    simGEEFlood,
    showLULC,
    showLithology,
    showGroundwater,
    showMalaria,
    activeCyclone,
    Boolean(floodImpactTileUrl),
    Boolean(forestLayerVisible && forestDynamicsResult?.gee_layer?.tile_url),
  ].filter(Boolean).length + adminActiveLevels.length;

  return (
    <>
    <div className="simgeo-shell flex h-screen w-full text-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar Principal */}
      <aside className="simgeo-sidebar flex flex-col z-20">
        <div className="simgeo-brand">
          <div className="flex items-center gap-3">
            <div className="simgeo-brand-mark">
              <svg className="w-6 h-6 text-white relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h1 className="simgeo-brand-name">SimGeo</h1>
              <p className="simgeo-brand-tagline">Decision intelligence</p>
            </div>
          </div>
          <p className="simgeo-brand-note">Dados da Terra transformados em decisões mais humanas e resilientes.</p>
        </div>

        {/* Menu Items */}
        <nav className="simgeo-sidebar-scroll flex-1 p-4 space-y-2 overflow-y-auto" aria-label="Camadas e simuladores">
          <div className="simgeo-section-label">Contexto territorial</div>
          
          {/* === Limites Administrativos FAO GAUL 2015 === */}
          <div className="px-1 mb-2">
            <AdminBoundaryPanel
              activeLevels={adminActiveLevels}
              setActiveLevels={setAdminActiveLevels}
              nameFilter={adminNameFilter}
              setNameFilter={setAdminNameFilter}
            />
          </div>

          <button 
            onClick={() => setShowInfrastructure(!showInfrastructure)}
            aria-pressed={showInfrastructure}
            className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${showInfrastructure ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              Infraestrutura
            </div>
            <span className="simgeo-switch" aria-hidden="true" />
          </button>

          <div className="simgeo-section-label mt-6 border-t border-slate-800/50 pt-4">Laboratório de cenários</div>


          <div className="simgeo-layer-list">
            <button 
              onClick={() => setSimGEEFlood(!simGEEFlood)}
              aria-pressed={simGEEFlood}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${simGEEFlood ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Inundação Costeira
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>
            
            {simGEEFlood && (
              <div className="simgeo-control-card transition-all">
                <label className="text-xs text-slate-400 flex justify-between mb-2">
                  <span>Nível da Água (m)</span>
                  <span className="font-mono text-cyan-400 font-bold">{waterLevel}m</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  step="0.5"
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(parseFloat(e.target.value))}
                  className="w-full accent-cyan-500 bg-slate-800 rounded-lg appearance-none h-2"
                />
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  Utiliza o DEM SRTM via Google Earth Engine para simular a elevação do nível do mar em tempo real.
                </p>
              </div>
            )}

            {/* Aptidão Ambiental para a Malária */}
            <button
              onClick={() => setShowMalaria(!showMalaria)}
              aria-pressed={showMalaria}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${showMalaria ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4M7 7l10 10m0-10L7 17"></path></svg>
                Aptidão para Malária
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>

            {showMalaria && (
              <div className="simgeo-control-card transition-all">
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] text-slate-400 block mb-1">De</label>
                    <select
                      value={malariaStartYear}
                      onChange={e => {
                        const year = Number(e.target.value);
                        setMalariaStartYear(year);
                        if (year > malariaEndYear) setMalariaEndYear(year);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1.5 outline-none"
                    >
                      {MALARIA_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[10px] text-slate-400 block mb-1">Até</label>
                    <select
                      value={malariaEndYear}
                      onChange={e => {
                        const year = Number(e.target.value);
                        setMalariaEndYear(year);
                        if (year < malariaStartYear) setMalariaStartYear(year);
                      }}
                      className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1.5 outline-none"
                    >
                      {MALARIA_YEARS.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </div>
                </div>

                <label className="text-[10px] text-slate-400 block mb-1">Período</label>
                <select
                  value={malariaMonth}
                  onChange={e => setMalariaMonth(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1.5 mb-3 outline-none"
                >
                  {MALARIA_MONTHS.map((name, month) => <option key={name} value={month}>{name}</option>)}
                </select>

                <div className="text-xs text-slate-300 font-medium mb-2">Índice ambiental (0–1)</div>
                <div className="grid grid-cols-5 gap-1 mb-1">
                  {['#1a9850', '#91cf60', '#fee08b', '#fc8d59', '#d73027'].map(color => (
                    <div key={color} className="h-2 rounded-sm" style={{ backgroundColor: color }}></div>
                  ))}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500 mb-3">
                  <span>Muito baixa</span>
                  <span>Moderada</span>
                  <span>Muito alta</span>
                </div>

                <p className="text-[10px] text-slate-400 leading-relaxed mb-2">
                  30% temperatura · 25% chuva · 20% água · 15% vegetação · 10% elevação
                </p>
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[10px] leading-relaxed text-amber-200">
                  Aptidão ambiental, não casos de malária. A interpretação deve ser combinada com dados epidemiológicos, entomológicos e de acesso aos serviços.
                </div>
              </div>
            )}

            <button 
              onClick={() => setShowLULC(!showLULC)}
              aria-pressed={showLULC}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${showLULC ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Uso do Solo (LULC)
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>
            
            {showLULC && (
              <div className="simgeo-control-card transition-all">
                <h4 className="text-xs font-semibold text-slate-300 mb-2">Legenda (ESA WorldCover)</h4>
                <div className="space-y-1.5 text-xs text-slate-400">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: '#006400'}}></div> Vegetação</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: '#90EE90'}}></div> Agricultura</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: '#FFFF00'}}></div> Solo Nu</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: '#00FFFF'}}></div> Corpos de Água</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm shadow-sm" style={{backgroundColor: '#808080'}}></div> Área Urbana</div>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowForestDynamicsPanel(true)}
              aria-pressed={Boolean(forestLayerVisible && forestDynamicsResult)}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${forestLayerVisible && forestDynamicsResult ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 21V10m0 0C8 10 5.5 7.8 5 4c4.3-.2 7 1.8 7 6zm0 4c3.8 0 6.3-2 7-5.8-4.1-.4-6.7 1.4-7 5.8zM8 21h8" />
                </svg>
                Dinâmica Florestal
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>

            <button 
              onClick={() => setShowLithology(!showLithology)}
              aria-pressed={showLithology}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${showLithology ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                Análise Litológica (ASTER)
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>
            
            {showLithology && (
              <div className="simgeo-control-card transition-all">
                <label className="text-xs text-slate-400 flex justify-between mb-2">
                  <span>Índice Mineral</span>
                </label>
                <select 
                  value={lithologyType} 
                  onChange={(e) => setLithologyType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 mb-3 outline-none focus:border-orange-500/50"
                >
                  <option value="kaolinite">Caulinita (Kaolinite)</option>
                  <option value="alunite">Alunita (Alunite)</option>
                  <option value="calcite">Calcita (Calcite)</option>
                  <option value="quartz">Quartzo (Quartz)</option>
                  <option value="carbonate">Carbonatos (Carbonate)</option>
                  <option value="mafic">Rochas Máficas (Mafic)</option>
                </select>

                <div className="text-xs text-slate-400 mb-1">Concentração (Heatmap)</div>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#440154] via-[#2a788e] to-[#fde725]"></div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                  <span>Baixa</span>
                  <span>Alta</span>
                </div>
              </div>
            )}
            
            {/* GLDAS Águas Subterrâneas */}
            <button 
              onClick={() => setShowGroundwater(!showGroundwater)}
              aria-pressed={showGroundwater}
              className={`simgeo-layer-toggle w-full flex items-center justify-between px-3 py-2.5 transition-all border ${showGroundwater ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'text-slate-400 hover:text-slate-200 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                Águas Subterrâneas (GLDAS)
              </div>
              <span className="simgeo-switch" aria-hidden="true" />
            </button>
            
            {showGroundwater && (
              <div className="simgeo-control-card transition-all">
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Mês</label>
                    <select value={gwMonth} onChange={e => setGwMonth(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1 outline-none">
                      {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">Ano</label>
                    <select value={gwYear} onChange={e => setGwYear(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1 outline-none">
                      {[...Array(22)].map((_, i) => <option key={2003+i} value={2003+i}>{2003+i}</option>)}
                    </select>
                  </div>
                </div>

                <div className="text-xs text-slate-400 mb-1">Humidade do Solo (mm)</div>
                <div className="h-2 w-full rounded-full bg-gradient-to-r from-[#7F3B08] via-[#9ACD32] to-[#1E6091]"></div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-1 mb-3">
                  <span>Seco</span>
                  <span>Úmido</span>
                </div>

                <div className="bg-slate-800/50 p-2 rounded border border-slate-700/50 mb-3">
                  <div className="text-[10px] text-slate-400 mb-1 flex justify-between items-center">
                    <span>Pontos de Monitorização ({gwCustomPoints.length}/5)</span>
                    {gwCustomPoints.length > 0 && (
                      <button onClick={() => setGwCustomPoints([])} className="text-red-400 hover:text-red-300">Limpar</button>
                    )}
                  </div>
                  {gwCustomPoints.length === 0 ? (
                    <div className="text-[10px] text-slate-500 italic py-1">
                      Clique no mapa para adicionar pontos de análise (Máx 5).
                    </div>
                  ) : (
                    <ul className="space-y-1">
                      {gwCustomPoints.map(pt => (
                        <li key={pt.name} className="text-[10px] text-slate-300 flex justify-between bg-slate-800/80 p-1.5 rounded">
                          <span className="font-medium text-blue-300">{pt.name}</span>
                          <span className="text-slate-500">[{pt.lng}, {pt.lat}]</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button 
                  onClick={() => {
                    setGwModalOpen(true);
                    fetchGwTimeSeries(); // Recalcula sempre para refletir novos pontos
                  }}
                  disabled={gwCustomPoints.length === 0}
                  className={`w-full py-1.5 text-xs rounded transition-colors font-medium border ${gwCustomPoints.length > 0 ? 'bg-blue-600/80 hover:bg-blue-500 text-white border-blue-500/50' : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                >
                  Abrir Análise Temporal
                </button>
              </div>
            )}

            
            {/* Secção de Administração */}
            <div className="pt-4 mt-2 border-t border-slate-800/50 mb-4">
              <h3 className="simgeo-section-label">Gestão de dados</h3>
              <div className="simgeo-control-card">
                <label className="text-[10px] text-slate-400 block mb-1">Carregar Dados Espaciais (.zip/.geojson)</label>
                <p className="text-[10px] text-slate-500 mb-2">Camada: infraestruturas</p>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept=".zip,.geojson,.json"
                  onChange={e => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30 file:cursor-pointer mb-2 cursor-pointer file:transition-colors"
                />
                <button 
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className={`w-full py-2 text-xs rounded-lg transition-all font-medium border flex items-center justify-center gap-2 ${uploadFile ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-400/30 shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                >
                  {uploading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      A Processar...
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                      Fazer Upload
                    </>
                  )}
                </button>
                {uploadSuccess && (
                  <div className={`mt-2 p-2 rounded text-xs text-center font-medium ${uploadSuccess.startsWith('❌') ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                    {uploadSuccess}
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </nav>

        {/* Backend Status Card */}
        <div className="simgeo-sidebar-footer">
          <div className="simgeo-api-card">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Estado do sistema</div>
              <div className="simgeo-api-status mt-1.5">
                <span className={`simgeo-status-dot ${loading ? '' : error ? 'is-offline' : 'is-online'}`} />
                <span>{loading ? 'A conectar…' : error ? 'API indisponível' : 'Todos os sistemas online'}</span>
              </div>
            </div>
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" /></svg>
          </div>
          {error && <p className="mt-2 px-1 text-[9px] leading-relaxed text-rose-300/75">{error}</p>}
        </div>
      </aside>

      {/* Main Content Area (Map) */}
      <main className="simgeo-map-stage flex-1 relative"> {/* Fundo do espaço sideral */}
        {/* Navbar superior com Blur */}
        <div className="simgeo-topbar absolute z-[1000] flex items-center justify-between pointer-events-none">
          <div className="simgeo-location-chip pointer-events-auto">
             <div className="simgeo-location-icon">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 21s7-4.35 7-11a7 7 0 10-14 0c0 6.65 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
             </div>
             <div className="simgeo-location-copy">
               <span>Moçambique</span>
               <small>Centro de decisão nacional</small>
             </div>
          </div>
          
          {/* Barra de Pesquisa */}
          <div className="simgeo-search relative pointer-events-auto">
            <div className="simgeo-search-field flex items-center px-3 py-2 gap-2">
              <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input 
                type="text" 
                placeholder="Pesquisar infraestruturas, locais..."
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                className="bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none w-full"
                aria-label="Pesquisar infraestruturas e locais"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }} className="text-slate-500 hover:text-white" aria-label="Limpar pesquisa">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="simgeo-search-results absolute top-full left-0 right-0 backdrop-blur-xl border overflow-hidden max-h-64 overflow-y-auto">
                {searchResults.map((r, idx) => (
                  <button
                    key={r.id || r.properties?.id || `${r.properties?.name || 'resultado'}-${idx}`}
                    onClick={() => {
                      // Criar buffer em redor do resultado
                      const coords = r.geometry?.coordinates;
                      if (coords) {
                        const [lng, lat] = Array.isArray(coords[0]) ? coords[0] : coords;
                        createBuffer(lng, lat, DEFAULT_BUFFER_RADIUS_KM);
                      }
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-800 transition-colors flex items-center gap-3 border-b border-slate-800/50 last:border-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0"></div>
                    <div>
                      <div className="text-sm text-slate-200">{r.properties?.name || 'Sem Nome'}</div>
                      <div className="text-[10px] text-slate-500">{r.properties?.type_display || r.properties?.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Alternador entre globo 3D e mapa plano 2D */}
            <button 
              onClick={() => setShowTerrain(!showTerrain)}
              aria-pressed={showTerrain}
              aria-label={showTerrain ? 'Mudar para mapa plano 2D' : 'Mudar para globo 3D'}
              title={showTerrain ? 'Globo 3D — mudar para mapa 2D' : 'Mapa 2D — mudar para globo 3D'}
              className={`simgeo-action w-10 px-0 ${showTerrain ? 'is-active' : ''}`}
            >
              {showTerrain ? (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
                  <path strokeLinecap="round" strokeWidth="1.8" d="M3.5 9h17M3.5 15h17M12 3c2.2 2.45 3.3 5.45 3.3 9S14.2 18.55 12 21M12 3C9.8 5.45 8.7 8.45 8.7 12s1.1 6.55 3.3 9" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.5 6.5 8.8 4l6.1 2.5L20.5 4v13.5L15.2 20l-6.1-2.5L3.5 20V6.5Z" />
                  <path strokeLinecap="round" strokeWidth="1.8" d="M8.9 4v13.5M15.1 6.5V20" />
                </svg>
              )}
            </button>
            {/* Botão Limpar Buffer */}
            {bufferData && (
              <button 
                onClick={() => setBufferData(null)}
                className="simgeo-action text-amber-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                <span>Limpar área</span>
              </button>
            )}
             <button 
               onClick={() => setShowCyclonePanel(true)}
               className="simgeo-action is-primary"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v14M5 12h14" /></svg>
               <span>Novo cenário</span>
             </button>
             <button 
               onClick={() => setShowFloodImpactPanel(true)}
               className="simgeo-action is-cyan"
             >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/></svg>
               <span>Impacto de cheias</span>
             </button>
          </div>
        </div>


        {/* Map Container */}
        <div className="absolute inset-0 z-10" onContextMenu={e => e.preventDefault()}>
          <DeckGL
            views={showTerrain ? new GlobeView({ id: 'globe', resolution: 10 }) : new MapView({ id: 'map', repeat: true })}
            viewState={viewState}
            onViewStateChange={({viewState}) => setViewState(viewState)}
            controller={true}
            onClick={handleMapClick}
            layers={[baseMapLayer, ...geeLayers, ...adminBoundaryLayers, ...vectorLayers]} // Carto DB Base Layer -> GEE -> Admin Boundaries -> Vectors
          >
            {/* Custom Tooltip renderizado pelo React (deck.gl hover) */}
            {tooltipInfo && (
              <div
                className="simgeo-map-tooltip absolute z-[1000] backdrop-blur text-white p-3 border min-w-40 pointer-events-none"
                style={{ left: tooltipInfo.x + 15, top: tooltipInfo.y + 15 }}
              >
                <div className="font-bold text-sm text-indigo-300 mb-1">{tooltipInfo.title}</div>
                {tooltipInfo.subtitle && <div className="text-slate-300 text-xs">{tooltipInfo.subtitle}</div>}
                {tooltipInfo.detail && <div className="text-slate-400 text-xs mt-1 pt-1 border-t border-slate-700">{tooltipInfo.detail}</div>}
              </div>
            )}
          </DeckGL>

          <div className="simgeo-map-hud" aria-live="polite">
            <div>
              <span className="block">Camadas ativas</span>
              <strong>{activeLayerCount}</strong>
            </div>
            <span className="simgeo-hud-divider" aria-hidden="true" />
            <div>
              <span className="block">Nível de zoom</span>
              <strong>{Number(viewState.zoom || 0).toFixed(1)}</strong>
            </div>
            <span className="simgeo-hud-divider" aria-hidden="true" />
            <div>
              <span className="block">Modo</span>
              <strong>{showTerrain ? 'Globo 3D' : 'Mapa 2D'}</strong>
            </div>
          </div>

          {(simGEEFlood || showLULC || showLithology || showGroundwater ||
            showMalaria || activeCyclone || floodImpactTileUrl ||
            (forestLayerVisible && forestDynamicsResult) ||
            adminActiveLevels.length > 0) && geeError && (
            <div className="absolute bottom-20 left-6 z-[1000]">
              <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/50 p-4 rounded-xl shadow-xl max-w-sm text-xs text-amber-200 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  Google Earth Engine Requer Autenticação
                </div>
                <p className="text-slate-300">{geeError}</p>
              </div>
            </div>
          )}
        </div>
      </main>
      
    </div>
      
      {/* Painel de Ciclones */}
      {showCyclonePanel && (
        <div className="simgeo-dialog-backdrop flex items-center justify-center p-5" role="presentation">
          <CyclonePanel
            onClose={() => setShowCyclonePanel(false)}
            activeCyclone={activeCyclone}
            setActiveCyclone={setActiveCyclone}
            cycloneStart={cycloneStart}
            setCycloneStart={setCycloneStart}
            cycloneEnd={cycloneEnd}
            setCycloneEnd={setCycloneEnd}
            cycloneLayerType={cycloneLayerType}
            setCycloneLayerType={setCycloneLayerType}
          />
        </div>
      )}

      {/* Painel de Flood Impact */}
      {showFloodImpactPanel && (
        <div className="simgeo-dialog-backdrop flex items-center justify-center p-5" role="presentation">
          <FloodImpactPanel
            onClose={() => setShowFloodImpactPanel(false)}
            floodEngine={floodEngine}
            setFloodEngine={value => updateFloodParameter(setFloodEngine, value)}
            floodReturnPeriod={floodReturnPeriod}
            setFloodReturnPeriod={value => updateFloodParameter(setFloodReturnPeriod, value)}
            floodS1Start={floodS1Start}
            setFloodS1Start={value => updateFloodParameter(setFloodS1Start, value)}
            floodS1End={floodS1End}
            setFloodS1End={value => updateFloodParameter(setFloodS1End, value)}
            floodStats={floodStats}
            floodLoading={floodLoading}
            error={geeError}
            onSimulate={async () => {
              setFloodLoading(true);
              setFloodStats(null);
              setFloodImpactTileUrl(null);
              setGeeError(null);
              try {
                const body = {
                  engine: floodEngine,
                  return_period: floodReturnPeriod,
                  s1_start: floodEngine === 'sentinel1' ? floodS1Start : undefined,
                  s1_end: floodEngine === 'sentinel1' ? floodS1End : undefined,
                };
                const res = await axios.post(`${API_BASE_URL}simulation/gee/flood-impact/`, body);
                const d = res.data.data;
                setFloodImpactTileUrl(d.gee_layer.tile_url);
                setFloodStats(d.stats);
              } catch(err) {
                console.error('Flood Impact error:', err);
                setGeeError('Erro ao simular impacto: ' + (err.response?.data?.error || err.message));
              } finally {
                setFloodLoading(false);
              }
            }}
          />
        </div>
      )}

      {/* Painel de Dinâmica Florestal */}
      {showForestDynamicsPanel && (
        <div className="simgeo-dialog-backdrop flex items-center justify-center p-5" role="presentation">
          <ForestDynamicsPanel
            onClose={() => setShowForestDynamicsPanel(false)}
            result={forestDynamicsResult}
            onResult={setForestDynamicsResult}
            layerVisible={forestLayerVisible}
            onLayerVisibilityChange={setForestLayerVisible}
            setErrorMessage={setGeeError}
          />
        </div>
      )}

      {/* Modal Recharts (GLDAS) */}
      {gwModalOpen && (
        <div className="simgeo-dialog-backdrop flex items-center justify-center p-6">
          <div className="simgeo-modal w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="simgeo-modal-header flex items-center justify-between p-5 border-b bg-slate-900/30">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                Análise Temporal de Águas Subterrâneas (GLDAS)
              </h2>
              <button onClick={() => setGwModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800" aria-label="Fechar análise temporal">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex-1 p-6 flex flex-col relative bg-slate-950">
              {gwLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-blue-400 gap-4">
                  <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                  <p className="text-sm font-medium">Extraindo série temporal do Google Earth Engine...</p>
                  <p className="text-xs text-slate-500 max-w-md text-center">Este processo cruza anos de dados satélite diariamente e calcula a média para Moçambique. Pode demorar alguns segundos.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-slate-400">Armazenamento de água subterrânea em milímetros (mm) de 2018 a 2023.</p>
                    <button onClick={fetchGwTimeSeries} className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-2">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                      Recalcular
                    </button>
                  </div>
                  
                  <div className="flex-1 min-h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={gwData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="#64748b" 
                          tick={{ fill: '#64748b', fontSize: 12 }} 
                          tickMargin={10} 
                          minTickGap={30}
                        />
                        <YAxis 
                          stroke="#64748b" 
                          tick={{ fill: '#64748b', fontSize: 12 }}
                          label={{ value: 'Armazenamento (mm)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 12 }}
                        />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#e2e8f0', fontSize: '13px' }}
                          itemStyle={{ padding: '2px 0' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="Moçambique (Média)" stroke="#3b82f6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        {gwCustomPoints.map((pt, idx) => {
                          const colors = ["#f59e0b", "#10b981", "#ef4444", "#a855f7", "#ec4899"];
                          return (
                            <Line key={pt.name} type="monotone" dataKey={pt.name} stroke={colors[idx % colors.length]} strokeWidth={2} dot={false} />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    {/* Botão Flutuante do Chatbot */}
    <button 
      onClick={() => setChatOpen(!chatOpen)}
      className="simgeo-chat-trigger fixed bottom-6 right-6 flex items-center justify-center transition-transform hover:-translate-y-0.5 z-[2000]"
      aria-expanded={chatOpen}
      aria-label={chatOpen ? 'Fechar assistente SimGeo' : 'Abrir assistente SimGeo'}
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
      <span>Pergunte à SimGeo</span>
    </button>

    {/* Interface do Chatbot */}
    {chatOpen && (
      <div className="simgeo-chat-window fixed bottom-24 right-6 w-96 max-h-[600px] h-[70vh] backdrop-blur-xl border flex flex-col z-[2000] overflow-hidden" role="dialog" aria-label="Assistente espacial SimGeo">
        {/* Header */}
        <div className="simgeo-chat-header p-4 border-b border-slate-700/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            </div>
            <div>
              <h3 className="text-slate-100 font-semibold text-sm">IA Espacial</h3>
              <p className="text-indigo-400 text-xs">SimGeo Agent</p>
            </div>
          </div>
          <button onClick={() => setChatOpen(false)} className="text-slate-400 hover:text-white transition-colors" aria-label="Fechar assistente">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
          {chatMessages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm border border-slate-700'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {chatLoading && (
            <div className="flex justify-start">
              <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-sm px-4 py-3 border border-slate-700 flex gap-2">
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
              </div>
            </div>
          )}
        </div>
        
        {/* Input */}
        <div className="p-3 border-t border-slate-700/50 bg-slate-900">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2">
            <input 
              type="text" 
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
              placeholder="Ex: Onde estão os hospitais?"
              className="flex-1 bg-transparent text-sm text-slate-200 outline-none"
              aria-label="Mensagem para o assistente SimGeo"
            />
            <button 
              onClick={handleSendChatMessage}
              disabled={chatLoading || !chatInput.trim()}
              className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Enviar mensagem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
