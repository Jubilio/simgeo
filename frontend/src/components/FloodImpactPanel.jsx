const RETURN_PERIODS = [10, 20, 50, 75, 100, 200, 500];

function StatCard({ label, value, unit, color }) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold ${color || 'text-white'}`}>
        {value !== null && value !== undefined ? value.toLocaleString('pt-PT') : '—'}
        {value !== null && value !== undefined && <span className="text-xs font-normal text-slate-400 ml-1">{unit}</span>}
      </span>
    </div>
  );
}

export default function FloodImpactPanel({
  onClose,
  floodEngine, setFloodEngine,
  floodReturnPeriod, setFloodReturnPeriod,
  floodS1Start, setFloodS1Start,
  floodS1End, setFloodS1End,
  floodStats, floodLoading,
  onSimulate
}) {
  return (
    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-900 border border-slate-700 p-5 rounded-xl shadow-2xl z-[200] w-[420px] text-slate-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-700">
        <h3 className="font-semibold flex items-center gap-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"/>
          </svg>
          Simulação de Impacto de Cheias
        </h3>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Fechar painel de impacto de cheias">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="space-y-4">

        {/* Motor de Simulação */}
        <div>
          <label className="block text-xs text-slate-400 mb-2">Motor de Simulação</label>
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setFloodEngine('glofas')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${floodEngine === 'glofas' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              GLOFAS (Período Retorno)
            </button>
            <button
              type="button"
              onClick={() => setFloodEngine('sentinel1')}
              className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${floodEngine === 'sentinel1' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Sentinel-1 (Evento Real)
            </button>
          </div>
        </div>

        {/* Opções GLOFAS */}
        {floodEngine === 'glofas' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Período de Retorno</label>
            <select
              value={floodReturnPeriod}
              onChange={e => setFloodReturnPeriod(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 text-sm rounded p-2 outline-none"
            >
              {RETURN_PERIODS.map(p => (
                <option key={p} value={p}>{p} anos</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              Dataset: JRC/CEMS_GLOFAS — Profundidade de cheia estatisticamente esperada para este período.
            </p>
          </div>
        )}

        {/* Opções Sentinel-1 */}
        {floodEngine === 'sentinel1' && (
          <div className="space-y-2">
            <label className="block text-xs text-slate-400">Período do Evento (pós-cheia)</label>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">Data Início</label>
                <input type="date" value={floodS1Start} onChange={e => setFloodS1Start(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 outline-none" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-1">Data Fim</label>
                <input type="date" value={floodS1End} onChange={e => setFloodS1End(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-xs rounded p-2 outline-none" />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Dataset: Copernicus S1-GRD — Deteção SAR de anomalias de água em bandas VH.
            </p>
          </div>
        )}

        {/* Botão Simular */}
        <button
          type="button"
          onClick={onSimulate}
          disabled={floodLoading}
          className="w-full py-2 rounded-lg font-medium text-sm bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-wait transition-colors flex items-center justify-center gap-2"
        >
          {floodLoading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              A calcular no Earth Engine...
            </>
          ) : '▶  Simular Impacto'}
        </button>

        {/* Legenda */}
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <div className="w-4 h-3 rounded-sm bg-cyan-400 opacity-80"></div>
          <span>Área inundada detectada / modelada</span>
        </div>

        {/* Estatísticas de Exposição */}
        {floodStats && (
          <>
            <div className="border-t border-slate-700 pt-3">
              <div className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wide">
                Exposição Estimada
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="População Exposta"
                  value={floodStats.exposed_population}
                  unit="pessoas"
                  color="text-red-400"
                />
                <StatCard
                  label="Agricultura Afectada"
                  value={floodStats.exposed_agriculture_ha}
                  unit="ha"
                  color="text-amber-400"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              Fontes: WorldPop ~100 m (2020) + ESA WorldCover (classe agrícola). Cálculo de exposição a 100 m.
            </p>
            <p className="text-[10px] text-slate-500">
              Resultado de triagem. Não substitui modelação hidráulica local nem avaliação de campo.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
