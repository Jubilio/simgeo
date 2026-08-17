import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { API_BASE_URL } from '../config';

const FALLBACK_CONFIG = {
  years: { min: 2000, max: 2022, default_start: 2015, default_end: 2022 },
  species: [
    { value: 'cattle', label: 'Bovinos' },
    { value: 'buffalo', label: 'Búfalos' },
    { value: 'goat', label: 'Caprinos' },
    { value: 'sheep', label: 'Ovinos' },
    { value: 'horse', label: 'Equinos' },
  ],
  map_modes: [
    { value: 'headcount', label: 'Efetivo estimado' },
    { value: 'livestock_change', label: 'Variação do efetivo' },
    { value: 'pasture_class', label: 'Classe de pastagem' },
    { value: 'pasture_change', label: 'Mudança de pastagem' },
    { value: 'pasture_pressure', label: 'Pressão sobre pastagens' },
  ],
};

function formatNumber(value, digits = 0) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-PT', {
    maximumFractionDigits: digits,
  }).format(value);
}

function StatCard({ label, value, unit, tone = 'text-white', detail }) {
  return (
    <div className="rounded-2xl border border-white/7 bg-slate-900/55 p-4 shadow-lg shadow-slate-950/20">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</span>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${tone}`}>
        {formatNumber(value, 1)}
        <span className="ml-1.5 text-[10px] font-normal text-slate-500">{unit}</span>
      </div>
      {detail ? <p className="mt-1 text-[10px] text-slate-500">{detail}</p> : null}
    </div>
  );
}

function ChangeBadge({ value, unit = '%' }) {
  if (value === null || value === undefined) return <span className="text-slate-600">—</span>;
  const positive = value >= 0;
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${positive ? 'border-lime-400/20 bg-lime-400/8 text-lime-300' : 'border-rose-400/20 bg-rose-400/8 text-rose-300'}`}>
      {positive ? '+' : ''}{formatNumber(value, 1)}{unit}
    </span>
  );
}

export default function LivestockDynamicsPanel({
  onClose,
  result,
  onResult,
  layerVisible,
  onLayerVisibilityChange,
  mapMode,
  onMapModeChange,
  setErrorMessage,
}) {
  const [config, setConfig] = useState(FALLBACK_CONFIG);
  const [startYear, setStartYear] = useState(result?.metadata?.start_year || 2015);
  const [endYear, setEndYear] = useState(result?.metadata?.end_year || 2022);
  const [species, setSpecies] = useState(result?.metadata?.species || 'cattle');
  const [adminLevel, setAdminLevel] = useState(result?.metadata?.admin_level || 1);
  const [rankingQuery, setRankingQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    axios.get(`${API_BASE_URL}simulation/gee/livestock-dynamics/`, {
      signal: controller.signal,
    })
      .then(response => setConfig(response.data?.data || FALLBACK_CONFIG))
      .catch(error => {
        if (axios.isCancel(error)) return;
        setLocalError(error.response?.data?.error || 'Não foi possível carregar a configuração do módulo.');
      });
    return () => controller.abort();
  }, []);

  const years = useMemo(
    () => Array.from(
      { length: config.years.max - config.years.min + 1 },
      (_, index) => config.years.min + index,
    ),
    [config.years],
  );
  const availableEndYears = years.filter(year => year > startYear);
  const stats = result?.stats;
  const mapLayer = result?.gee_layers?.[mapMode];

  const rankingRows = useMemo(() => {
    const query = rankingQuery.trim().toLocaleLowerCase('pt');
    const rows = result?.admin_summary || [];
    if (!query) return rows.slice(0, 15);
    return rows.filter(row => (
      `${row.name || ''} ${row.parent_name || ''} ${row.pcode || ''}`
        .toLocaleLowerCase('pt')
        .includes(query)
    )).slice(0, 30);
  }, [rankingQuery, result?.admin_summary]);

  const handleStartYear = event => {
    const nextYear = Number(event.target.value);
    setStartYear(nextYear);
    if (endYear <= nextYear) setEndYear(Math.min(config.years.max, nextYear + 1));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setLocalError(null);
    setErrorMessage?.(null);
    try {
      const response = await axios.post(
        `${API_BASE_URL}simulation/gee/livestock-dynamics/`,
        {
          start_year: startYear,
          end_year: endYear,
          species,
          admin_level: adminLevel,
        },
      );
      onResult(response.data.data);
      onMapModeChange('headcount');
      onLayerVisibilityChange(true);
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Erro ao analisar a dinâmica pecuária.';
      setLocalError(message);
      setErrorMessage?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="simgeo-modal relative z-[200] flex max-h-[92vh] w-[1180px] max-w-[97vw] flex-col overflow-hidden text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="livestock-panel-title"
    >
      <header className="simgeo-modal-header flex items-center justify-between border-b px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-400/20 to-lime-400/5 shadow-lg shadow-amber-950/30">
            <svg className="h-6 w-6 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M5 13.5V9.8c0-2.2 1.8-4 4-4h4.5c2.1 0 3.8 1.5 4.2 3.5l.3 1.7h1.5v3H18l-.7 4H15l-.4-3H9.4L9 18H6.7L6 14.5H4v-1h1Zm3-7.7L6 3.5M15.5 6 18 3.8M9 10h.01" />
            </svg>
          </div>
          <div>
            <span className="simgeo-modal-kicker">Território, produção e clima</span>
            <h2 id="livestock-panel-title" className="mt-0.5 text-lg font-semibold text-white">Dinâmica pecuária e pastagens</h2>
            <p className="mt-1 text-xs text-slate-500">Efetivo modelado, cobertura de pastagem e pressão territorial</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result ? (
            <button
              type="button"
              onClick={() => onLayerVisibilityChange(!layerVisible)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${layerVisible ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : 'border-slate-700 bg-slate-800/70 text-slate-400'}`}
              aria-pressed={layerVisible}
            >
              {layerVisible ? 'Camada visível' : 'Mostrar camada'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fechar dinâmica pecuária">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[330px_1fr] lg:overflow-hidden">
        <aside className="border-b border-white/7 bg-slate-950/35 p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-5 rounded-2xl border border-amber-300/10 bg-amber-400/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-amber-200">Global Pasture Watch</span>
              <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">1 km + 30 m · GEE</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Efetivos ajustados à FAOSTAT e classes anuais de pastagem, disponíveis entre 2000 e 2022.</p>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="livestock-species" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Espécie</label>
              <select id="livestock-species" value={species} onChange={event => setSpecies(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none focus:border-amber-400/40">
                {config.species.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Janela temporal</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[10px] text-slate-500">
                  Ano inicial
                  <select value={startYear} onChange={handleStartYear} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none">
                    {years.slice(0, -1).map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-slate-500">
                  Ano final
                  <select value={endYear} onChange={event => setEndYear(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none">
                    {availableEndYears.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Resumo administrativo</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900/75 p-1">
                {[[1, 'Admin1'], [2, 'Admin2']].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAdminLevel(value)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${adminLevel === value ? 'bg-amber-500/18 text-amber-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    aria-pressed={adminLevel === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-lime-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-950/35 transition hover:from-amber-500 hover:to-lime-500 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  A processar no GEE…
                </>
              ) : 'Analisar dinâmica'}
            </button>

            {localError ? <div className="rounded-xl border border-rose-400/20 bg-rose-400/8 p-3 text-[11px] leading-relaxed text-rose-200">{localError}</div> : null}

            {result ? (
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Visualização do mapa</div>
                <div className="space-y-1.5">
                  {config.map_modes.map(mode => (
                    <button
                      type="button"
                      key={mode.value}
                      onClick={() => {
                        onMapModeChange(mode.value);
                        onLayerVisibilityChange(true);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] transition-colors ${mapMode === mode.value ? 'border-amber-400/25 bg-amber-400/8 text-amber-200' : 'border-transparent bg-slate-900/35 text-slate-500 hover:text-slate-300'}`}
                      aria-pressed={mapMode === mode.value}
                    >
                      <span>{mode.label}</span>
                      <span className={`h-2 w-2 rounded-full ${mapMode === mode.value ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,.7)]' : 'bg-slate-700'}`} />
                    </button>
                  ))}
                </div>
                {mapLayer?.legend?.length ? (
                  <div className="mt-3 space-y-1.5 rounded-xl bg-slate-900/45 p-3">
                    {mapLayer.legend.map(item => (
                      <div key={item.value} className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>

        <main className="min-h-[540px] bg-[radial-gradient(circle_at_82%_8%,rgba(245,158,11,0.08),transparent_28rem)] p-5 lg:overflow-y-auto lg:p-6">
          {loading && !result ? (
            <div className="flex h-full min-h-[500px] flex-col items-center justify-center text-center">
              <div className="relative mb-5 h-16 w-16">
                <span className="absolute inset-0 animate-ping rounded-full bg-amber-400/10" />
                <span className="absolute inset-2 animate-spin rounded-full border-2 border-amber-400/15 border-t-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">A reconstruir a paisagem pecuária</h3>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">O Earth Engine está a cruzar efetivos, pastagens e limites administrativos para todo o período.</p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-400">Resultado nacional</span>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">{result.metadata.species_label} em Moçambique</h3>
                  <p className="mt-1 text-xs text-slate-500">{result.metadata.start_year}–{result.metadata.end_year} · ranking por {result.metadata.admin_level === 1 ? 'província' : 'distrito'}</p>
                </div>
                <ChangeBadge value={stats.livestock_change_pct} />
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <StatCard label={`Efetivo ${result.metadata.start_year}`} value={stats.livestock_start} unit="animais" />
                <StatCard label={`Efetivo ${result.metadata.end_year}`} value={stats.livestock_end} unit="animais" tone="text-amber-200" />
                <StatCard label="Variação estimada" value={stats.livestock_change} unit="animais" tone={stats.livestock_change >= 0 ? 'text-lime-300' : 'text-rose-300'} />
                <StatCard label="Pastagem no ano final" value={stats.pasture_end_km2} unit="km²" tone="text-lime-200" />
                <StatCard label="Pressão no ano final" value={stats.pasture_pressure_end} unit="animais/km²" tone="text-orange-200" detail="efetivo ÷ área estimada de pastagem" />
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.25fr_.75fr]">
                <div className="rounded-2xl border border-white/7 bg-slate-900/45 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-200">Evolução anual</h4>
                      <p className="mt-0.5 text-[10px] text-slate-500">Efetivo estimado e pressão sobre pastagens</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] uppercase tracking-wider text-slate-500">2000–2022</span>
                  </div>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.timeseries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="#1e293b" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="livestock" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={value => formatNumber(value)} tickLine={false} axisLine={false} width={58} />
                        <YAxis yAxisId="pressure" orientation="right" stroke="#f59e0b" tick={{ fill: '#b45309', fontSize: 10 }} tickLine={false} axisLine={false} width={42} />
                        <RechartsTooltip
                          formatter={(value, name) => [formatNumber(value, 1), name === 'livestock' ? 'Efetivo' : 'Pressão']}
                          labelFormatter={year => `Ano ${year}`}
                          contentStyle={{ background: '#0b1220', border: '1px solid rgba(148,163,184,.18)', borderRadius: 12, color: '#e2e8f0', fontSize: 11 }}
                        />
                        <Line yAxisId="livestock" type="monotone" dataKey="livestock" stroke="#a3e635" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                        <Line yAxisId="pressure" type="monotone" dataKey="pasture_pressure" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
                  <StatCard label="Pastagem cultivada" value={stats.cultivated_end_km2} unit="km²" tone="text-yellow-200" />
                  <StatCard label="Pastagem natural/seminatural" value={stats.natural_end_km2} unit="km²" tone="text-orange-200" />
                  <StatCard label="Mudança de pastagem" value={stats.pasture_change_km2} unit="km²" tone={stats.pasture_change_km2 >= 0 ? 'text-lime-300' : 'text-rose-300'} detail={`${formatNumber(stats.pasture_change_pct, 1)}% no período`} />
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/7 bg-slate-900/45">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/7 px-4 py-3">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Ranking administrativo</h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">Estimativas GPW ligadas ao perfil humano OCHA por correspondência administrativa</p>
                  </div>
                  <label className="relative">
                    <span className="sr-only">Filtrar ranking administrativo</span>
                    <svg className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" /></svg>
                    <input value={rankingQuery} onChange={event => setRankingQuery(event.target.value)} placeholder="Filtrar província, distrito ou P-code" className="w-64 max-w-full rounded-xl border border-slate-700 bg-slate-950/70 py-2 pl-9 pr-3 text-[11px] text-slate-300 outline-none placeholder:text-slate-600 focus:border-amber-400/35" />
                  </label>
                </div>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-950/95 text-[9px] uppercase tracking-[0.1em] text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Área</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Efetivo {result.metadata.end_year}</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Mudança</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Pastagem km²</th>
                        <th className="px-3 py-2.5 text-right font-semibold">Pressão</th>
                        <th className="px-4 py-2.5 text-right font-semibold">Animais/100 pessoas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {rankingRows.map((row, index) => (
                        <tr key={`${row.name}-${row.parent_name}`} className="text-slate-400 hover:bg-white/[.025]">
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-3">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-400/8 font-mono text-[9px] text-amber-300">{index + 1}</span>
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-slate-200">{row.name}</span>
                                <span className="block truncate text-[9px] text-slate-600">{row.pcode || row.parent_name || 'Sem correspondência OCHA'}</span>
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-slate-300">{formatNumber(row.livestock_end)}</td>
                          <td className="px-3 py-2.5 text-right"><ChangeBadge value={row.change_pct} /></td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatNumber(row.pasture_end_km2, 1)}</td>
                          <td className="px-3 py-2.5 text-right font-mono">{formatNumber(row.pasture_pressure, 1)}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{formatNumber(row.animals_per_100_people, 1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!rankingRows.length ? <p className="py-8 text-center text-xs text-slate-600">Nenhuma área corresponde ao filtro.</p> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 px-4 py-3 text-[10px] leading-relaxed text-amber-100/65">
                {result.metadata.disclaimer}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[500px] items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-amber-300/10 bg-amber-400/5">
                  <svg className="h-9 w-9 text-amber-300/75" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19h16M5 15c3.5-3 5.5-7 6-11 2.5 4.8 5.1 8.2 8 10M7 10c2 .7 4.2.8 6 .2" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Onde os rebanhos encontram a paisagem</h3>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Escolha a espécie, o período e o nível administrativo. O SimGeo mostrará como o efetivo estimado e a disponibilidade de pastagens mudaram no território.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
