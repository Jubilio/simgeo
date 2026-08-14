import { useMemo, useState } from 'react';


const GROUPS = {
  demography: {
    label: 'Demografia',
    indicators: [
      ['population_total', 'População total'],
      ['population_female', 'População feminina'],
      ['female_share', 'Mulheres (%)'],
      ['population_under_5', 'Menores de 5'],
      ['population_under_18', '0–17 anos'],
      ['under_18_share', '0–17 anos (%)'],
      ['population_60_plus', '60+ anos'],
      ['pwd_planning_estimate', 'PcD — estimativa'],
    ],
  },
  displacement: {
    label: 'Mobilidade',
    indicators: [
      ['idps_dtm_r22', 'IDPs — DTM R22'],
      ['returnees_dtm_r22', 'Retornados — DTM R22'],
      ['dtm_caseload', 'Caseload combinado'],
      ['dtm_caseload_rate', 'Caseload / população'],
    ],
  },
};

const NUMBER_FORMAT = new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 0 });
const DECIMAL_FORMAT = new Intl.NumberFormat('pt-MZ', { maximumFractionDigits: 2 });

const formatValue = (value, unit) => {
  if (value === null || value === undefined) return 'Sem dados';
  return unit === '%' ? `${DECIMAL_FORMAT.format(value)}%` : NUMBER_FORMAT.format(value);
};

const normalizeSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt');

const findGroup = indicator => (
  Object.entries(GROUPS).find(([, group]) => (
    group.indicators.some(([value]) => value === indicator)
  ))?.[0] || 'demography'
);


export function AdminBaselinePanel({
  active,
  setActive,
  level,
  setLevel,
  indicator,
  setIndicator,
  data,
  loading,
  error,
  selectedPcode,
  onSelectArea,
  onRetry,
}) {
  const [query, setQuery] = useState('');
  const group = findGroup(indicator);
  const indicatorMeta = data?.indicator_meta;
  const selectedArea = data?.areas?.find(area => area.pcode === selectedPcode) || null;
  const visibleAreas = useMemo(() => {
    const normalized = normalizeSearch(query.trim());
    if (normalized.length < 2) return [];
    return (data?.areas || []).filter(area => (
      normalizeSearch(`${area.name} ${area.pcode} ${area.parent_name}`).includes(normalized)
    )).slice(0, 6);
  }, [data?.areas, query]);
  const palette = (indicatorMeta?.palette || ['172554', '22D3EE', 'F8FAFC'])
    .map(color => `#${color}`)
    .join(', ');

  const changeGroup = nextGroup => {
    setIndicator(GROUPS[nextGroup].indicators[0][0]);
  };

  const changeLevel = nextLevel => {
    setLevel(nextLevel);
    setQuery('');
  };

  return (
    <section className={`admin-baseline-card ${active ? 'is-active' : ''}`} aria-labelledby="admin-baseline-title">
      <div className="admin-baseline-heading">
        <span className="admin-baseline-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 19V9m5 10V5m5 14v-7m5 7V3M2 21h20" />
          </svg>
        </span>
        <div>
          <span id="admin-baseline-title" className="admin-baseline-title">Perfil humano</span>
          <span className="admin-baseline-subtitle">OCHA · POP 2025 · DTM R22</span>
        </div>
        <button
          type="button"
          className={`simgeo-switch ${active ? 'is-active' : ''}`}
          onClick={() => setActive(!active)}
          aria-label={active ? 'Desativar perfil humano' : 'Ativar perfil humano'}
          aria-pressed={active}
        />
      </div>

      {active ? (
        <div className="admin-baseline-body">
          <div className="admin-baseline-segmented" aria-label="Nível administrativo">
            {[1, 2].map(option => (
              <button
                type="button"
                key={option}
                className={level === option ? 'is-active' : ''}
                onClick={() => changeLevel(option)}
                aria-pressed={level === option}
              >
                ADM{option}
              </button>
            ))}
          </div>

          <div className="admin-baseline-groups" aria-label="Família de indicadores">
            {Object.entries(GROUPS).map(([key, value]) => (
              <button
                type="button"
                key={key}
                className={group === key ? 'is-active' : ''}
                onClick={() => changeGroup(key)}
              >
                {value.label}
              </button>
            ))}
          </div>

          <label className="admin-baseline-field">
            <span>Indicador no mapa</span>
            <select value={indicator} onChange={event => setIndicator(event.target.value)}>
              {GROUPS[group].indicators.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          {loading ? (
            <div className="admin-baseline-status">
              <span className="admin-boundary-spinner" aria-hidden="true" /> A preparar indicador…
            </div>
          ) : null}

          {data ? (
            <>
              <div className="admin-baseline-summary">
                <span>{indicatorMeta?.label}</span>
                <strong>{formatValue(data.national_summary?.[indicator], indicatorMeta?.unit)}</strong>
                <small>Total nacional · dados disponíveis</small>
              </div>

              <div className="admin-baseline-legend" aria-label="Legenda do indicador">
                <div style={{ background: `linear-gradient(90deg, ${palette})` }} />
                <span>{formatValue(data.legend?.min, indicatorMeta?.unit)}</span>
                <span>{formatValue(data.legend?.max, indicatorMeta?.unit)}</span>
              </div>

              <label className="admin-baseline-field admin-baseline-search">
                <span>Explorar área</span>
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder={level === 1 ? 'Província ou P-code' : 'Distrito ou P-code'}
                />
              </label>

              {query.trim().length >= 2 ? (
                <div className="admin-baseline-results" role="listbox">
                  {visibleAreas.map(area => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={area.pcode === selectedPcode}
                      key={area.pcode}
                      onClick={() => {
                        setQuery(area.name);
                        onSelectArea(area);
                      }}
                    >
                      <span>{area.name}</span>
                      <small>{area.pcode} · {formatValue(area.indicator_value, indicatorMeta?.unit)}</small>
                    </button>
                  ))}
                  {visibleAreas.length === 0 ? <small className="admin-baseline-empty">Nenhuma área encontrada.</small> : null}
                </div>
              ) : null}

              {selectedArea ? (
                <div className="admin-baseline-profile">
                  <div className="admin-baseline-profile-title">
                    <div>
                      <strong>{selectedArea.name}</strong>
                      <small>{selectedArea.pcode} · {selectedArea.parent_name}</small>
                    </div>
                    <span>ADM{selectedArea.level}</span>
                  </div>
                  <dl>
                    <div><dt>População</dt><dd>{formatValue(selectedArea.metrics.population_total, 'pessoas')}</dd></div>
                    <div><dt>Mulheres</dt><dd>{formatValue(selectedArea.metrics.female_share, '%')}</dd></div>
                    <div><dt>0–17 anos</dt><dd>{formatValue(selectedArea.metrics.under_18_share, '%')}</dd></div>
                    <div><dt>IDPs</dt><dd>{formatValue(selectedArea.metrics.idps_dtm_r22, 'pessoas')}</dd></div>
                  </dl>
                </div>
              ) : null}

              {indicatorMeta?.caveat ? <p className="admin-baseline-caveat">{indicatorMeta.caveat}</p> : null}
              <p className="admin-baseline-provenance">
                Join por P-code · {data.legend?.available} áreas com valor · {data.legend?.missing} sem dados
              </p>
              {data.gee_layer ? (
                <p className="admin-baseline-provenance">
                  Geometria GAUL 2015 · {data.gee_layer.matched} correspondências · {data.gee_layer.unmatched?.length || 0} sem geometria associada
                </p>
              ) : null}
            </>
          ) : null}

          {error ? (
            <div className="admin-baseline-error">
              <span>{data ? 'O perfil está disponível, mas a camada não carregou.' : 'Não foi possível carregar o perfil.'}</span>
              <button type="button" onClick={onRetry}>Tentar novamente</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
