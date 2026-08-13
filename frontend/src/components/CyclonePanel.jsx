import { useState } from 'react';

const CYCLONES = [
  { id: 'idai', name: 'Ciclone Idai (2019)', start: '2019-03-14', end: '2019-03-16' },
  { id: 'kenneth', name: 'Ciclone Kenneth (2019)', start: '2019-04-24', end: '2019-04-26' },
  { id: 'freddy', name: 'Ciclone Freddy (2023)', start: '2023-03-11', end: '2023-03-13' },
  { id: 'custom', name: 'Personalizado...', start: '', end: '' }
];

export default function CyclonePanel({ 
  onClose,
  activeCyclone, setActiveCyclone,
  cycloneStart, setCycloneStart,
  cycloneEnd, setCycloneEnd,
  cycloneLayerType, setCycloneLayerType
}) {
  const [selectedCyclone, setSelectedCyclone] = useState(() => (
    CYCLONES.find(cyclone =>
      cyclone.id !== 'custom' &&
      cyclone.start === cycloneStart &&
      cyclone.end === cycloneEnd
    )?.id || 'custom'
  ));

  const handleSelect = (id) => {
    setSelectedCyclone(id);
    const cyclone = CYCLONES.find(c => c.id === id);
    if (cyclone && id !== 'custom') {
      setCycloneStart(cyclone.start);
      setCycloneEnd(cyclone.end);
    }
  };

  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 p-5 rounded-xl shadow-2xl z-[200] w-96 text-slate-200">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
        <h3 className="font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A4 4 0 002 12.271m12.752-.103l-3.197 2.132a4 4 0 01-9.555-3.236M21.996 12.271a4 4 0 01-7.244 3.236M21.996 12.271a4 4 0 00-7.244-3.236m7.244 3.236c-.021.09-.044.18-.069.271M14.752 9.036c.021-.09.044-.18.069-.271"></path></svg>
          Simulação de Ciclones
        </h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Fechar painel de ciclones">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="space-y-4">
        {/* Toggle Ativar/Desativar */}
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm font-medium">Activar Camada</span>
          <button
            type="button"
            aria-pressed={activeCyclone}
            aria-label="Activar ou desactivar camada de ciclone"
            className={`w-10 h-5 rounded-full transition-colors relative ${activeCyclone ? 'bg-indigo-500' : 'bg-slate-700'}`}
            onClick={() => setActiveCyclone(previous => !previous)}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${activeCyclone ? 'left-5' : 'left-1'}`}></span>
          </button>
        </label>

        {/* Seleção do Ciclone */}
        <div>
          <label className="block text-xs text-slate-400 mb-1">Evento Histórico</label>
          <select 
            value={selectedCyclone}
            onChange={(e) => handleSelect(e.target.value)}
            disabled={!activeCyclone}
            className="w-full bg-slate-800 border border-slate-700 text-sm rounded p-2 outline-none disabled:opacity-50"
          >
            {CYCLONES.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Datas (Custom) */}
        {selectedCyclone === 'custom' && (
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">Data Início</label>
              <input 
                type="date" 
                value={cycloneStart}
                onChange={(e) => setCycloneStart(e.target.value)}
                disabled={!activeCyclone}
                className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-slate-400 mb-1">Data Fim</label>
              <input 
                type="date" 
                value={cycloneEnd}
                onChange={(e) => setCycloneEnd(e.target.value)}
                disabled={!activeCyclone}
                className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 outline-none"
              />
            </div>
          </div>
        )}

        {/* Tipo de Visualização */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Visualização</label>
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setCycloneLayerType('rain')}
              disabled={!activeCyclone}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${cycloneLayerType === 'rain' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Precipitação (Chuva)
            </button>
            <button
              type="button"
              onClick={() => setCycloneLayerType('wind')}
              disabled={!activeCyclone}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${cycloneLayerType === 'wind' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Velocidade Vento
            </button>
          </div>
        </div>

        {/* Legenda (Muda consoante o tipo) */}
        {activeCyclone && (
          <div className="bg-slate-900/50 p-3 rounded border border-slate-800 mt-2">
            <div className="text-[10px] text-slate-400 mb-1">
              {cycloneLayerType === 'rain' ? 'Acumulado GPM IMERG (mm)' : 'Máximo horário ERA5-Land a 10 m (km/h)'}
            </div>
            {cycloneLayerType === 'rain' ? (
              <div className="h-2 w-full rounded-sm bg-gradient-to-r from-[#e0f3db] via-[#4eb3d3] to-[#b30000]"></div>
            ) : (
              <div className="h-2 w-full rounded-sm bg-gradient-to-r from-[#ffffcc] via-[#fd8d3c] to-[#800026]"></div>
            )}
            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
              <span>{cycloneLayerType === 'rain' ? '20mm' : '50km/h'}</span>
              <span>{cycloneLayerType === 'rain' ? '>300mm' : '>200km/h'}</span>
            </div>
          </div>
        )}
        <p className="text-[10px] text-slate-500 leading-relaxed">
          Camadas ambientais de apoio; não representam trajetória oficial, rajada observada ou categoria do ciclone.
        </p>
      </div>
    </div>
  );
}
