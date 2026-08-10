import { useEffect, useState } from 'react';
import axios from 'axios';
import DeckGL from '@deck.gl/react';
import { _GlobeView as GlobeView } from '@deck.gl/core';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import useMapLayers from './components/MapLayers';
import useGEELayer from './components/GEELayer';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const API_URL = 'http://localhost:8000/api/';

const INITIAL_VIEW_STATE = {
  longitude: 34.84,
  latitude: -19.83,
  zoom: 1.5, // Zoom mais afastado para ver o globo
  pitch: 30,
  bearing: 0
};

export default function App() {
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estado das camadas do mapa
  const [showBoundaries, setShowBoundaries] = useState(false);
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
  
  // Estado para Upload
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadLayerType, setUploadLayerType] = useState('infrastructure');
  const [uploading, setUploading] = useState(false);
  
  const [waterLevel, setWaterLevel] = useState(2.0);
  const [geeError, setGeeError] = useState(null);

  // Tooltip UI
  const [tooltipInfo, setTooltipInfo] = useState(null);

  useEffect(() => {
    // Tenta conectar à API do Django
    axios.get(API_URL)
      .then(response => {
        setApiData(response.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erro ao conectar à API:", err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const vectorLayers = useMapLayers({
    showBoundaries,
    showInfrastructure,
    setTooltipInfo,
    gwCustomPoints
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
    setErrorMessage: setGeeError
  });

  // Função para buscar dados da série temporal GLDAS
  const fetchGwTimeSeries = async () => {
    setGwLoading(true);
    try {
      const response = await axios.post(`${API_URL}simulation/gee/groundwater/timeseries/`, {
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
    
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('layer_type', uploadLayerType);
    
    try {
      const res = await axios.post(`${API_URL}upload/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message);
      setUploadFile(null);
      // Limpar o input type=file seria feito com ref, mas aqui basta state
    } catch (err) {
      alert(err.response?.data?.error || "Erro no upload");
    } finally {
      setUploading(false);
    }
  };

  // Base Map Layer nativo do Deck.gl (Raster)
  const baseMapLayer = new TileLayer({
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
  });

  return (
    <>
    <div className="flex h-screen w-full bg-slate-950 text-slate-100 font-sans overflow-hidden">
      
      {/* Sidebar Principal */}
      <aside className="w-72 bg-slate-900/80 backdrop-blur-xl border-r border-slate-800 flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400 tracking-tight">SimGeo</h1>
              <p className="text-xs text-slate-400 font-medium tracking-wider uppercase">DSS Platform</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-2 px-3">Camadas Base</div>
          
          <button 
            onClick={() => setShowBoundaries(!showBoundaries)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border ${showBoundaries ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path></svg>
              Limites Admin.
            </div>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${showBoundaries ? 'bg-indigo-500' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showBoundaries ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: showBoundaries ? 'translateX(14px)' : 'translateX(0)' }}></div>
            </div>
          </button>

          <button 
            onClick={() => setShowInfrastructure(!showInfrastructure)}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all border ${showInfrastructure ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              Infraestrutura
            </div>
            <div className={`w-8 h-4 rounded-full transition-colors relative ${showInfrastructure ? 'bg-emerald-500' : 'bg-slate-700'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showInfrastructure ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: showInfrastructure ? 'translateX(14px)' : 'translateX(0)' }}></div>
            </div>
          </button>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 mt-6 px-3 border-t border-slate-800/50 pt-4">Simuladores (GEE)</div>

          <div className="px-3">
            <button 
              onClick={() => setSimGEEFlood(!simGEEFlood)}
              className={`w-full flex items-center justify-between px-3 py-2.5 mb-3 rounded-lg transition-all border ${simGEEFlood ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Inundação Costeira
              </div>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${simGEEFlood ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${simGEEFlood ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: simGEEFlood ? 'translateX(14px)' : 'translateX(0)' }}></div>
              </div>
            </button>
            
            {simGEEFlood && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 mt-2 mb-4 transition-all">
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

            <button 
              onClick={() => setShowLULC(!showLULC)}
              className={`w-full flex items-center justify-between px-3 py-2.5 mb-3 rounded-lg transition-all border ${showLULC ? 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                Uso do Solo (LULC)
              </div>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${showLULC ? 'bg-fuchsia-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showLULC ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: showLULC ? 'translateX(14px)' : 'translateX(0)' }}></div>
              </div>
            </button>
            
            {showLULC && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 mt-2 mb-4 transition-all">
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
              onClick={() => setShowLithology(!showLithology)}
              className={`w-full flex items-center justify-between px-3 py-2.5 mb-3 rounded-lg transition-all border ${showLithology ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                Análise Litológica (ASTER)
              </div>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${showLithology ? 'bg-orange-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showLithology ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: showLithology ? 'translateX(14px)' : 'translateX(0)' }}></div>
              </div>
            </button>
            
            {showLithology && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 mt-2 mb-4 transition-all">
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
              className={`w-full flex items-center justify-between px-3 py-2.5 mb-3 rounded-lg transition-all border ${showGroundwater ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent'}`}
            >
              <div className="flex items-center gap-3 text-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                Águas Subterrâneas (GLDAS)
              </div>
              <div className={`w-8 h-4 rounded-full transition-colors relative ${showGroundwater ? 'bg-blue-500' : 'bg-slate-700'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${showGroundwater ? 'left-4.5 right-0.5' : 'left-0.5'}`} style={{ transform: showGroundwater ? 'translateX(14px)' : 'translateX(0)' }}></div>
              </div>
            </button>
            
            {showGroundwater && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 mt-2 mb-4 transition-all">
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
                      {gwCustomPoints.map((pt, idx) => (
                        <li key={idx} className="text-[10px] text-slate-300 flex justify-between bg-slate-800/80 p-1.5 rounded">
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
            
            {simGEEFlood && (
              <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 mt-2 mb-4 transition-all">
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
            
            {/* Secção de Administração */}
            <div className="pt-4 mt-2 border-t border-slate-800/50 mb-4">
              <h3 className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-2">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                Administração
              </h3>
              <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                <label className="text-[10px] text-slate-400 block mb-1">Carregar Dados Espaciais (.zip/.geojson)</label>
                <select value={uploadLayerType} onChange={e => setUploadLayerType(e.target.value)} className="w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded p-1.5 mb-2 outline-none">
                  <option value="infrastructure">Infraestruturas (Pontos)</option>
                  <option value="boundary">Limites (Polígonos)</option>
                </select>
                <input 
                  type="file" 
                  accept=".zip,.geojson,.json"
                  onChange={e => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-400 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-700 mb-2 cursor-pointer"
                />
                <button 
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className={`w-full py-1.5 text-xs rounded transition-colors font-medium border flex items-center justify-center gap-2 ${uploadFile ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white border-indigo-500/50 shadow-[0_0_10px_rgba(79,70,229,0.3)]' : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}`}
                >
                  {uploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      A Processar...
                    </>
                  ) : (
                    'Fazer Upload'
                  )}
                </button>
              </div>
            </div>
            
          </div>
        </nav>

        {/* Backend Status Card */}
        <div className="p-4 border-t border-slate-800/50">
          <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 shadow-inner">
            <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>
              Django API Status
            </h3>
            
            {loading ? (
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse"></div>
                <span className="text-sm text-yellow-400">Conectando...</span>
              </div>
            ) : error ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]"></div>
                  <span className="text-sm text-rose-400 font-medium">Desconectado</span>
                </div>
                <p className="text-xs text-rose-500/80 font-mono bg-rose-500/10 p-2 rounded">{error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                  <span className="text-sm text-emerald-400 font-medium">Conectado</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area (Map) */}
      <main className="flex-1 relative bg-[#020617]"> {/* Fundo do espaço sideral */}
        {/* Navbar superior com Blur */}
        <div className="absolute top-0 left-0 right-0 h-16 bg-slate-900/60 backdrop-blur-md z-[1000] border-b border-white/5 flex items-center justify-between px-6 pointer-events-none">
          <div className="flex items-center gap-4">
             <div className="px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium text-slate-300 pointer-events-auto shadow-lg">
                Sofala, Moçambique
             </div>
          </div>
          <div className="flex items-center gap-4 pointer-events-auto">
             <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20 border border-indigo-400/20">
               + Novo Cenário
             </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="absolute inset-0 z-10" onContextMenu={e => e.preventDefault()}>
          <DeckGL
            views={new GlobeView()}
            initialViewState={INITIAL_VIEW_STATE}
            controller={true}
            onClick={handleMapClick}
            layers={[baseMapLayer, ...geeLayers, ...vectorLayers]} // Carto DB Base Layer -> GEE -> Vectors
          >
            {/* Custom Tooltip renderizado pelo React (deck.gl hover) */}
            {tooltipInfo && (
              <div
                className="absolute z-[1000] bg-slate-900/90 backdrop-blur text-white p-3 rounded-lg shadow-xl border border-slate-700 min-w-40 pointer-events-none"
                style={{ left: tooltipInfo.x + 15, top: tooltipInfo.y + 15 }}
              >
                <div className="font-bold text-sm text-indigo-300 mb-1">{tooltipInfo.title}</div>
                {tooltipInfo.subtitle && <div className="text-slate-300 text-xs">{tooltipInfo.subtitle}</div>}
                {tooltipInfo.detail && <div className="text-slate-400 text-xs mt-1 pt-1 border-t border-slate-700">{tooltipInfo.detail}</div>}
              </div>
            )}
          </DeckGL>

          {simGEEFlood && geeError && (
            <div className="absolute bottom-6 left-6 z-[1000]">
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
      
      {/* Modal Recharts (GLDAS) */}
      {gwModalOpen && (
        <div className="absolute inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                Análise Temporal de Águas Subterrâneas (GLDAS)
              </h2>
              <button onClick={() => setGwModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800">
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
    </>
  );
}
