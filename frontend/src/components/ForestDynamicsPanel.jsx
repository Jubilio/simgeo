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

const MAX_YEAR = new Date().getFullYear() - 1;
const YEARS = Array.from({ length: MAX_YEAR - 2015 }, (_, index) => 2016 + index);
const DEFAULT_START_YEAR = Math.max(2016, MAX_YEAR - 9);

function formatArea(value, maximumFractionDigits = 0) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits }).format(value);
}

function StatCard({ label, value, unit = 'ha', accent = 'text-white', detail }) {
  return (
    <div className="rounded-2xl border border-white/7 bg-slate-900/55 p-4 shadow-lg shadow-slate-950/20">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">{label}</span>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${accent}`}>
        {formatArea(value, 1)}
        <span className="ml-1.5 text-xs font-normal text-slate-500">{unit}</span>
      </div>
      {detail ? <p className="mt-1 text-[10px] text-slate-500">{detail}</p> : null}
    </div>
  );
}

function TransitionList({ title, subtitle, items, accent }) {
  const maximum = Math.max(...(items || []).map(item => item.area_ha), 1);
  return (
    <div className="rounded-2xl border border-white/7 bg-slate-900/45 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
        <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
      </div>
      {items?.length ? (
        <div className="space-y-3">
          {items.slice(0, 5).map(item => (
            <div key={item.class_value}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-slate-300">{item.class_name}</span>
                <span className="shrink-0 font-mono text-slate-400">{formatArea(item.area_ha, 1)} ha</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${accent}`}
                  style={{ width: `${Math.max((item.area_ha / maximum) * 100, 2)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-xs text-slate-600">Nenhuma transição identificada.</p>
      )}
    </div>
  );
}

export default function ForestDynamicsPanel({
  onClose,
  result,
  onResult,
  layerVisible,
  onLayerVisibilityChange,
  setErrorMessage,
}) {
  const [startYear, setStartYear] = useState(result?.metadata?.start_year || DEFAULT_START_YEAR);
  const [endYear, setEndYear] = useState(result?.metadata?.end_year || MAX_YEAR);
  const [scope, setScope] = useState(result?.metadata?.scope || 'country');
  const [areaName, setAreaName] = useState(
    result?.metadata?.scope && result.metadata.scope !== 'country'
      ? result.metadata.region
      : '',
  );
  const [customGeometry, setCustomGeometry] = useState(null);
  const [customFileName, setCustomFileName] = useState('');
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState(null);

  useEffect(() => {
    if (scope !== 'province') return undefined;

    const controller = new AbortController();
    setAreasLoading(true);
    axios.get(`${API_BASE_URL}simulation/gee/forest-dynamics/?scope=province`, {
      signal: controller.signal,
    })
      .then(response => {
        const availableAreas = response.data?.areas || [];
        setAreas(availableAreas);
        setAreaName(current => (
          availableAreas.includes(current) ? current : availableAreas[0] || ''
        ));
      })
      .catch(error => {
        if (axios.isCancel(error)) return;
        const message = error.response?.data?.error || 'Não foi possível carregar as províncias.';
        setLocalError(message);
      })
      .finally(() => setAreasLoading(false));

    return () => controller.abort();
  }, [scope]);

  const availableEndYears = YEARS.filter(year => year > startYear && year - startYear < 10);
  const chartData = useMemo(
    () => result?.timeseries || [],
    [result?.timeseries],
  );
  const stats = result?.stats;
  const netPositive = (stats?.net_change_ha || 0) >= 0;
  const selectedPeriodYears = endYear - startYear + 1;

  const chartDomain = useMemo(() => {
    if (!chartData.length) return ['auto', 'auto'];
    const values = chartData.map(item => item.forest_area_ha);
    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const padding = Math.max((maximum - minimum) * 0.3, maximum * 0.01, 1);
    return [Math.max(0, minimum - padding), maximum + padding];
  }, [chartData]);

  const handleStartYear = event => {
    const nextStart = Number(event.target.value);
    setStartYear(nextStart);
    if (endYear <= nextStart || endYear - nextStart >= 10) {
      setEndYear(Math.min(MAX_YEAR, nextStart + 9));
    }
  };

  const handleGeometryFile = async event => {
    const file = event.target.files?.[0];
    setCustomGeometry(null);
    setCustomFileName('');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setLocalError('O GeoJSON não pode exceder 5 MB. Simplifique a geometria.');
      event.target.value = '';
      return;
    }

    try {
      const geojson = JSON.parse(await file.text());
      const supportedTypes = new Set(['Polygon', 'MultiPolygon', 'Feature', 'FeatureCollection']);
      if (!supportedTypes.has(geojson?.type)) {
        throw new Error('Use um Polygon, MultiPolygon, Feature ou FeatureCollection.');
      }
      const displayName = file.name.replace(/\.(geo)?json$/i, '') || 'Área personalizada';
      setCustomGeometry(geojson);
      setCustomFileName(file.name);
      setAreaName(displayName);
      setLocalError(null);
    } catch (error) {
      setLocalError(error.message || 'O ficheiro não contém um GeoJSON válido.');
      event.target.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (scope === 'province' && !areaName) {
      setLocalError('Selecione uma província para continuar.');
      return;
    }
    if (scope === 'custom' && !customGeometry) {
      setLocalError('Carregue o polígono GeoJSON da área de análise.');
      return;
    }

    setLoading(true);
    setLocalError(null);
    setErrorMessage?.(null);
    try {
      const response = await axios.post(
        `${API_BASE_URL}simulation/gee/forest-dynamics/`,
        {
          start_year: startYear,
          end_year: endYear,
          scope,
          area_name: scope === 'province' ? areaName : null,
          ...(scope === 'custom' ? {
            area_name: areaName || 'Área personalizada',
            geometry: customGeometry,
          } : {}),
        },
      );
      onResult(response.data.data);
      onLayerVisibilityChange(true);
    } catch (error) {
      const message = error.response?.data?.error || error.message || 'Erro ao analisar a dinâmica florestal.';
      setLocalError(message);
      setErrorMessage?.(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="simgeo-modal relative z-[200] flex max-h-[90vh] w-[1120px] max-w-[96vw] flex-col overflow-hidden text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forest-panel-title"
    >
      <header className="simgeo-modal-header flex items-center justify-between border-b px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-emerald-400/20 to-lime-400/5 shadow-lg shadow-emerald-950/30">
            <svg className="h-6 w-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 21V10m0 0C8 10 5.5 7.8 5 4c4.3-.2 7 1.8 7 6zm0 4c3.8 0 6.3-2 7-5.8-4.1-.4-6.7 1.4-7 5.8zM8 21h8" />
            </svg>
          </div>
          <div>
            <span className="simgeo-modal-kicker">Monitorização da paisagem</span>
            <h2 id="forest-panel-title" className="mt-0.5 text-lg font-semibold text-white">Dinâmica florestal</h2>
            <p className="mt-1 text-xs text-slate-500">Estoque anual, ganhos, perdas e transições de cobertura</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {result ? (
            <button
              type="button"
              onClick={() => onLayerVisibilityChange(!layerVisible)}
              className={`rounded-xl border px-3 py-2 text-xs font-medium transition-colors ${layerVisible ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-slate-700 bg-slate-800/70 text-slate-400'}`}
              aria-pressed={layerVisible}
            >
              {layerVisible ? 'Camada visível' : 'Mostrar camada'}
            </button>
          ) : null}
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Fechar dinâmica florestal">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[330px_1fr] lg:overflow-hidden">
        <aside className="border-b border-white/7 bg-slate-950/35 p-5 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="mb-5 rounded-2xl border border-emerald-300/10 bg-emerald-400/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-emerald-200">Dynamic World</span>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">10 m · GEE</span>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Composto anual pela classe modal. O ano de 2015 foi excluído por ter cobertura temporal incompleta.</p>
          </div>

          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Área de análise</legend>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900/75 p-1">
                {[
                  ['country', 'Moçambique'],
                  ['province', 'Província'],
                  ['custom', 'GeoJSON'],
                ].map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setScope(value)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-colors ${scope === value ? 'bg-emerald-500/18 text-emerald-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    aria-pressed={scope === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>

            {scope === 'province' ? (
              <div>
                <label htmlFor="forest-province" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Província</label>
                <select
                  id="forest-province"
                  value={areaName}
                  onChange={event => setAreaName(event.target.value)}
                  disabled={areasLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none disabled:opacity-50"
                >
                  {areasLoading ? <option>A carregar…</option> : null}
                  {areas.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
              </div>
            ) : null}

            {scope === 'custom' ? (
              <div>
                <label htmlFor="forest-geometry" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Polígono da área</label>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-emerald-400/25 bg-emerald-400/5 px-3 py-3 transition-colors hover:bg-emerald-400/8">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10 text-emerald-300">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" /></svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium text-slate-300">{customFileName || 'Selecionar GeoJSON'}</span>
                    <span className="mt-0.5 block text-[9px] text-slate-600">AOI em Moçambique · máximo 5 MB</span>
                  </span>
                  <input id="forest-geometry" type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={handleGeometryFile} className="sr-only" />
                </label>
              </div>
            ) : null}

            <fieldset>
              <legend className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Janela temporal</legend>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[10px] text-slate-500">
                  Ano inicial
                  <select value={startYear} onChange={handleStartYear} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none">
                    {YEARS.slice(0, -1).map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
                <label className="text-[10px] text-slate-500">
                  Ano final
                  <select value={endYear} onChange={event => setEndYear(Number(event.target.value))} className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs text-slate-300 outline-none">
                    {availableEndYears.map(year => <option key={year} value={year}>{year}</option>)}
                  </select>
                </label>
              </div>
              <p className="mt-2 text-[10px] text-slate-600">{selectedPeriodYears} anos incluídos · máximo de 10</p>
            </fieldset>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={loading || areasLoading || (scope === 'province' && !areaName) || (scope === 'custom' && !customGeometry)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/35 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-wait disabled:opacity-50"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  A processar no GEE…
                </>
              ) : 'Analisar dinâmica'}
            </button>

            {localError ? (
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/8 p-3 text-[11px] leading-relaxed text-rose-200">{localError}</div>
            ) : null}

            <div>
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">Leitura do mapa</div>
              <div className="space-y-2 text-xs text-slate-400">
                {[
                  ['#0f766e', 'Floresta estável'],
                  ['#fb7185', 'Perda de floresta'],
                  ['#a3e635', 'Ganho de floresta'],
                ].map(([color, label]) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="h-2.5 w-5 rounded-full" style={{ backgroundColor: color }} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="min-h-[520px] bg-[radial-gradient(circle_at_82%_8%,rgba(16,185,129,0.08),transparent_28rem)] p-5 lg:overflow-y-auto lg:p-6">
          {loading && !result ? (
            <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
              <div className="relative mb-5 h-16 w-16">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/10" />
                <span className="absolute inset-2 animate-spin rounded-full border-2 border-emerald-400/15 border-t-emerald-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-200">A cruzar a paisagem no tempo</h3>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-500">O Earth Engine está a compor cada ano, alinhar as classes e calcular os fluxos brutos e líquidos.</p>
            </div>
          ) : result ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">Resultado consolidado</span>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">{result.metadata.region}</h3>
                  <p className="mt-1 text-xs text-slate-500">{result.metadata.start_year}–{result.metadata.end_year} · estatísticas a {result.metadata.analysis_scale_m} m</p>
                </div>
                <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${netPositive ? 'border-lime-400/25 bg-lime-400/8 text-lime-300' : 'border-rose-400/25 bg-rose-400/8 text-rose-300'}`}>
                  Saldo {netPositive ? '+' : ''}{formatArea(stats.net_change_ha, 1)} ha ({netPositive ? '+' : ''}{formatArea(stats.net_change_pct, 2)}%)
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
                <StatCard label={`Floresta ${result.metadata.start_year}`} value={stats.initial_forest_ha} />
                <StatCard label={`Floresta ${result.metadata.end_year}`} value={stats.final_forest_ha} />
                <StatCard label="Ganho bruto" value={stats.forest_gain_ha} accent="text-lime-300" />
                <StatCard label="Perda bruta" value={stats.forest_loss_ha} accent="text-rose-300" />
                <StatCard label="Fluxo bruto" value={stats.gross_change_ha} accent="text-cyan-300" detail="ganhos + perdas" />
              </div>

              <div className="rounded-2xl border border-white/7 bg-slate-900/45 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-200">Evolução anual da cobertura arbórea</h4>
                    <p className="mt-0.5 text-[10px] text-slate-500">Área estimada em hectares</p>
                  </div>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[9px] uppercase tracking-wider text-slate-500">Série reprodutível</span>
                </div>
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 14, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke="#1e293b" strokeDasharray="3 5" vertical={false} />
                      <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickLine={false} axisLine={false} />
                      <YAxis domain={chartDomain} stroke="#64748b" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={value => formatArea(value)} tickLine={false} axisLine={false} width={64} />
                      <RechartsTooltip
                        formatter={value => [`${formatArea(value, 1)} ha`, 'Cobertura arbórea']}
                        labelFormatter={year => `Ano ${year}`}
                        contentStyle={{ background: '#0b1220', border: '1px solid rgba(148,163,184,.18)', borderRadius: 12, color: '#e2e8f0', fontSize: 11 }}
                      />
                      <Line type="monotone" dataKey="forest_area_ha" stroke="#34d399" strokeWidth={3} dot={{ r: 3, fill: '#0f172a', stroke: '#34d399', strokeWidth: 2 }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <TransitionList title="Destino da floresta perdida" subtitle="Classe observada no ano final" items={result.transitions.loss_to} accent="bg-rose-400" />
                <TransitionList title="Origem da floresta regenerada" subtitle="Classe observada no ano inicial" items={result.transitions.gain_from} accent="bg-lime-400" />
              </div>

              <div className="rounded-2xl border border-amber-300/10 bg-amber-300/5 px-4 py-3 text-[10px] leading-relaxed text-amber-100/65">
                {result.metadata.disclaimer}
              </div>
            </div>
          ) : (
            <div className="flex h-full min-h-[480px] items-center justify-center">
              <div className="max-w-md text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] border border-emerald-300/10 bg-emerald-400/5">
                  <svg className="h-9 w-9 text-emerald-300/75" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 19V9m5 10V5m5 14v-7m5 7V3M3 21h18" /></svg>
                </div>
                <h3 className="text-lg font-semibold text-slate-200">Da mudança no mapa à história da paisagem</h3>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">Escolha a área e o período. O SimGeo medirá o estoque anual, separará saldo líquido de fluxo bruto e mostrará para onde a cobertura arbórea foi — e de onde regressou.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </section>
  );
}
