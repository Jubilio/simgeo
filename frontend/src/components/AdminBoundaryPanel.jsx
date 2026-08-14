import { useEffect, useRef, useState } from 'react';

const LEVEL_META = {
  level1: { label: 'Províncias', color: '#FF8168', shortLabel: 'ADM1' },
  level2: { label: 'Distritos', color: '#43E0B3', shortLabel: 'ADM2' },
};

export function AdminBoundaryPanel({
  activeLevels,
  setActiveLevels,
  nameFilter,
  setNameFilter,
  searchResults = [],
  searchLoading = false,
  onSelectResult,
}) {
  const [inputValue, setInputValue] = useState(nameFilter || '');
  const [resultsOpen, setResultsOpen] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    setInputValue(nameFilter || '');
  }, [nameFilter]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const toggleLevel = (level) => {
    setActiveLevels(previous => (
      previous.includes(level)
        ? previous.filter(activeLevel => activeLevel !== level)
        : [...previous, level]
    ));
  };

  const handleNameInput = (event) => {
    const value = event.target.value;
    setInputValue(value);
    setResultsOpen(value.trim().length >= 2);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNameFilter(value), 500);
  };

  const selectResult = result => {
    clearTimeout(debounceRef.current);
    setInputValue(result.name);
    setResultsOpen(false);
    onSelectResult?.(result);
  };

  const clearFilter = () => {
    clearTimeout(debounceRef.current);
    setInputValue('');
    setNameFilter('');
    setResultsOpen(false);
  };

  return (
    <section className="admin-boundary-card" aria-labelledby="admin-boundary-title">
      <div className="admin-boundary-header">
        <span className="admin-boundary-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3zM9 3v15m6-12v15" />
          </svg>
        </span>
        <span id="admin-boundary-title" className="admin-boundary-title">Limites administrativos</span>
        <span className="admin-boundary-source">GAUL 2015</span>
      </div>

      <div className="admin-boundary-levels">
        {Object.entries(LEVEL_META).map(([level, meta]) => {
          const active = activeLevels.includes(level);
          return (
            <button
              type="button"
              key={level}
              onClick={() => toggleLevel(level)}
              className={`admin-level-button ${active ? 'is-active' : ''}`}
              style={{ '--level-color': meta.color }}
              aria-pressed={active}
              title={`Activar/desactivar ${meta.label}`}
            >
              <span className="admin-level-dot" aria-hidden="true" />
              <span className="admin-level-short">{meta.shortLabel}</span>
              <span className="admin-level-name">{meta.label}</span>
            </button>
          );
        })}
      </div>

      <div className="admin-boundary-search-wrap">
        <div className="admin-boundary-search">
          <button
            type="button"
            className="admin-boundary-search-submit"
            onClick={() => searchResults[0] && selectResult(searchResults[0])}
            disabled={!searchResults[0]}
            aria-label="Ir para o primeiro resultado"
          >
            <svg className="admin-boundary-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <input
            type="text"
            placeholder="Distrito ou província"
            value={inputValue}
            onChange={handleNameInput}
            onFocus={() => setResultsOpen(inputValue.trim().length >= 2)}
            onKeyDown={event => {
              if (event.key === 'Enter' && searchResults[0]) {
                event.preventDefault();
                selectResult(searchResults[0]);
              }
            }}
            className="admin-boundary-input"
            aria-label="Pesquisar e filtrar limites administrativos por nome"
            aria-expanded={resultsOpen}
          />
          {searchLoading ? <span className="admin-boundary-spinner" aria-label="A pesquisar" /> : null}
          {inputValue ? (
            <button type="button" onClick={clearFilter} className="admin-boundary-clear" aria-label="Limpar filtro">✕</button>
          ) : null}
        </div>

        {resultsOpen && inputValue.trim().length >= 2 ? (
          <div className="admin-boundary-results" role="listbox" aria-label="Resultados administrativos">
            {searchResults.map(result => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={result.id}
                onClick={() => selectResult(result)}
                className="admin-boundary-result"
              >
                <span className="admin-boundary-result-name">{result.name}</span>
                <span className="admin-boundary-result-type">
                  {result.level_label}{result.parent_name ? ` · ${result.parent_name}` : ''}
                </span>
              </button>
            ))}
            {!searchLoading && searchResults.length === 0 ? (
              <span className="admin-boundary-empty">Nenhuma área encontrada.</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {activeLevels.length > 0 ? (
        <div className="admin-boundary-legend" aria-label="Limites ativos">
          {activeLevels.map(level => (
            <div key={level} className="admin-boundary-legend-item">
              <span className="admin-boundary-legend-line" style={{ background: LEVEL_META[level].color }} />
              <span>{LEVEL_META[level].label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
