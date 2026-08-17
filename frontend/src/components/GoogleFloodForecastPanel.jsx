const NUMBER_FORMATTER = new Intl.NumberFormat('pt-PT');
const DATE_FORMATTER = new Intl.DateTimeFormat('pt-PT', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Africa/Maputo',
});

const formatNumber = value => (
  value === null || value === undefined ? '—' : NUMBER_FORMATTER.format(Number(value))
);

const formatDate = value => {
  if (!value) return 'Sem hora publicada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_FORMATTER.format(date);
};

function SummaryMetric({ label, value, tone }) {
  return (
    <div className={`google-flood-metric ${tone || ''}`}>
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </div>
  );
}

function EventButton({ event, type, onFocus }) {
  const isRiverine = type === 'riverine';
  const title = isRiverine
    ? event.severity_label
    : type === 'flash'
      ? 'Cheia rápida prevista'
      : 'Evento significativo';
  const subtitle = isRiverine
    ? `${event.source || 'Fonte Google'} · ${event.forecast_trend_label || 'Tendência não indicada'}`
    : type === 'flash'
      ? `Válida até ${formatDate(event.valid_until)}`
      : `${formatNumber(event.affected_population)} pessoas · ${formatNumber(event.area_km2)} km²`;
  return (
    <button type="button" className="google-flood-event" onClick={() => onFocus(event.id)}>
      <span className={`google-flood-event-dot is-${type}`} aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

export default function GoogleFloodForecastPanel({
  onClose,
  serviceStatus,
  data,
  loading,
  error,
  layerActive,
  onLayerActiveChange,
  onRefresh,
  onFocusEvent,
  floodHubUrl,
}) {
  const ready = serviceStatus?.ready;
  const summary = data?.summary || {};
  const localContext = data?.local_context;
  const areas = localContext?.admin_areas || [];
  const hasForecasts = summary.riverine_active
    || summary.flash_flood_events
    || summary.significant_events;

  return (
    <section
      className="simgeo-modal google-flood-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-flood-title"
    >
      <header className="google-flood-header">
        <div className="google-flood-heading">
          <span className="google-flood-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 15.5c2.5-2 4.5-2 7 0s4.5 2 7 0M4 11c2.5-2 4.5-2 7 0s4.5 2 7 0M12 3v4" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9.5 5.5 2.5-2.5 2.5 2.5" />
            </svg>
          </span>
          <div>
            <span className="simgeo-modal-kicker">Early warning · tempo real</span>
            <h2 id="google-flood-title">Google Floods</h2>
            <p>Previsão fluvial, cheias rápidas e contexto humanitário</p>
          </div>
        </div>
        <button type="button" className="google-flood-close" onClick={onClose} aria-label="Fechar previsões Google Floods">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeWidth="1.8" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div className="google-flood-body">
        <div className={`google-flood-readiness ${ready ? 'is-ready' : 'is-pending'}`}>
          <span className="google-flood-pulse" aria-hidden="true" />
          <div>
            <strong>{ready ? 'API oficial ligada' : 'Acesso API pendente'}</strong>
            <p>{serviceStatus?.message || 'A verificar a configuração do servidor…'}</p>
          </div>
        </div>

        {serviceStatus && !ready && !loading && (
          <div className="google-flood-fallback">
            <p>
              O módulo está instalado, mas a chave ainda não tem acesso operacional.
              Pode consultar a mesma zona diretamente no Flood Hub enquanto aguarda a aprovação.
            </p>
            <a href={floodHubUrl} target="_blank" rel="noreferrer" className="google-flood-primary-action">
              Abrir esta zona no Flood Hub
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M14 5h5v5M10 14 19 5M19 14v5H5V5h5" />
              </svg>
            </a>
          </div>
        )}

        {loading && (
          <div className="google-flood-loading" role="status">
            <span className="simgeo-search-spinner" aria-hidden="true" />
            A sincronizar previsões e geometrias…
          </div>
        )}

        {error && <div className="google-flood-error" role="alert">{error}</div>}

        {ready && data && (
          <>
            <div className="google-flood-toolbar">
              <button
                type="button"
                className={`google-flood-layer-toggle ${layerActive ? 'is-active' : ''}`}
                onClick={() => onLayerActiveChange(!layerActive)}
                aria-pressed={layerActive}
              >
                <span className="simgeo-switch" aria-hidden="true" />
                Mostrar previsões no mapa
              </button>
              <button type="button" className="google-flood-refresh" onClick={() => onRefresh(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
                </svg>
                Atualizar
              </button>
            </div>

            <div className="google-flood-summary">
              <SummaryMetric label="Alertas fluviais" value={summary.riverine_active} tone="is-cyan" />
              <SummaryMetric label="Cheias rápidas" value={summary.flash_flood_events} tone="is-orange" />
              <SummaryMetric label="Eventos críticos" value={summary.significant_events} tone="is-magenta" />
              <SummaryMetric label="Polígonos" value={summary.polygons_loaded} tone="is-violet" />
            </div>

            {!hasForecasts && (
              <div className="google-flood-calm">
                <strong>Sem eventos ativos devolvidos para Moçambique</strong>
                <span>Última consulta: {formatDate(data.generated_at)}</span>
              </div>
            )}

            {data.riverine?.length > 0 && (
              <div className="google-flood-section">
                <div className="google-flood-section-title">
                  <span>Previsão fluvial</span>
                  <small>{data.riverine.length} estações com alerta</small>
                </div>
                {data.riverine.slice(0, 6).map(event => (
                  <EventButton key={event.id} event={event} type="riverine" onFocus={onFocusEvent} />
                ))}
              </div>
            )}

            {data.flash_floods?.length > 0 && (
              <div className="google-flood-section">
                <div className="google-flood-section-title">
                  <span>Cheias rápidas · até 24 h</span>
                  <small>{data.flash_floods.length} eventos</small>
                </div>
                {data.flash_floods.slice(0, 5).map(event => (
                  <EventButton key={event.id} event={event} type="flash" onFocus={onFocusEvent} />
                ))}
              </div>
            )}

            {data.significant_events?.length > 0 && (
              <div className="google-flood-section">
                <div className="google-flood-section-title">
                  <span>Eventos de alto impacto</span>
                  <small>estimativa Google</small>
                </div>
                {data.significant_events.slice(0, 5).map(event => (
                  <EventButton key={event.id} event={event} type="significant" onFocus={onFocusEvent} />
                ))}
              </div>
            )}

            {localContext?.available && (
              <div className="google-flood-context">
                <div className="google-flood-section-title">
                  <span>Contexto Admin1/Admin2</span>
                  <small>OCHA + PostGIS</small>
                </div>
                <div className="google-flood-context-stats">
                  <div><strong>{formatNumber(localContext.summary?.admin1_count)}</strong><span>províncias</span></div>
                  <div><strong>{formatNumber(localContext.summary?.admin2_count)}</strong><span>distritos</span></div>
                  <div><strong>{formatNumber(localContext.infrastructure?.total)}</strong><span>infraestruturas</span></div>
                </div>
                {areas.length > 0 && (
                  <div className="google-flood-area-chips">
                    {areas.slice(0, 8).map(area => (
                      <span key={`${area.level}-${area.boundary_id}`}>
                        ADM{area.level} · {area.name}
                      </span>
                    ))}
                  </div>
                )}
                <p>{localContext.caveat}</p>
              </div>
            )}

            {data.warnings?.length > 0 && (
              <details className="google-flood-warnings">
                <summary>{data.warnings.length} avisos técnicos</summary>
                <ul>{data.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
              </details>
            )}
          </>
        )}

        <footer className="google-flood-footer">
          <span>Google Flood Forecasting · CC BY 4.0</span>
          <a href={floodHubUrl} target="_blank" rel="noreferrer">Ver no Flood Hub</a>
        </footer>
      </div>
    </section>
  );
}
