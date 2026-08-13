import { useEffect, useRef, useState } from 'react';

const LEVEL_META = {
  level1: { label: 'Províncias', color: '#FF8168', shortLabel: 'ADM1' },
  level2: { label: 'Distritos', color: '#43E0B3', shortLabel: 'ADM2' },
};

export function AdminBoundaryPanel({ activeLevels, setActiveLevels, nameFilter, setNameFilter }) {
  const [inputValue, setInputValue] = useState(nameFilter || '');
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
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNameFilter(value), 500);
  };

  const clearFilter = () => {
    clearTimeout(debounceRef.current);
    setInputValue('');
    setNameFilter('');
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

      <div className="admin-boundary-search">
        <svg className="admin-boundary-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Filtrar distrito ou província"
          value={inputValue}
          onChange={handleNameInput}
          className="admin-boundary-input"
          aria-label="Filtrar limites administrativos por nome"
        />
        {inputValue ? (
          <button type="button" onClick={clearFilter} className="admin-boundary-clear" aria-label="Limpar filtro">✕</button>
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
