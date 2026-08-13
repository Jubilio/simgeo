import { useEffect, useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

const LEVEL_META = {
  level1: { label: 'Províncias', color: '#FF6B35', shortLabel: 'ADM1' },
  level2: { label: 'Distritos',  color: '#4ECDC4', shortLabel: 'ADM2' },
};

const TILE_CONFIG = {
  minZoom: 0,
  maxZoom: 14,
  tileSize: 256,
  maxRequests: 2,
  maxCacheSize: 150,
  refinementStrategy: 'no-overlap',
};

/**
 * Hook que gere as camadas de limites administrativos GAUL.
 */
export function useAdminBoundaryLayers({ activeLevels, nameFilter, country = 'Mozambique', setErrorMessage }) {
  const [tileUrls, setTileUrls] = useState({ level1: null, level2: null });
  const abortRefs = useRef({});

  const fetchLevel = useCallback((level) => {
    if (abortRefs.current[level]) abortRefs.current[level].abort();
    const ctrl = new AbortController();
    abortRefs.current[level] = ctrl;

    setTileUrls(prev => ({ ...prev, [level]: null }));

    const params = new URLSearchParams({ level, country });
    if (nameFilter && nameFilter.trim().length > 1) params.set('name_filter', nameFilter.trim());

    axios.get(`${API_BASE}simulation/gee/admin-boundaries/?${params}`, { signal: ctrl.signal })
      .then(res => {
        const url = res.data?.gee_layer?.tile_url;
        if (url) setTileUrls(prev => ({ ...prev, [level]: url }));
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.warn(`GAUL ${level} error:`, err);
        setErrorMessage?.(`Erro ao carregar ${LEVEL_META[level].label}: ${err.response?.data?.error || err.message}`);
      });
  }, [nameFilter, country]);

  // Carregar/cancelar quando activeLevels ou nameFilter mudam
  useEffect(() => {
    ['level1', 'level2'].forEach(level => {
      if (activeLevels.includes(level)) {
        fetchLevel(level);
      } else {
        if (abortRefs.current[level]) abortRefs.current[level].abort();
        setTileUrls(prev => ({ ...prev, [level]: null }));
      }
    });
  }, [activeLevels.join(','), nameFilter]);

  // Construir as camadas DeckGL
  const layers = ['level1', 'level2']
    .filter(level => activeLevels.includes(level) && tileUrls[level])
    .map(level => new TileLayer({
      ...TILE_CONFIG,
      id: `gaul-${level}-${nameFilter || 'all'}`,
      data: tileUrls[level],
      opacity: 0.9,
      renderSubLayers: props => {
        const { bbox: { west, south, east, north } } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north],
        });
      },
    }));

  return { layers, tileUrls };
}

/**
 * Painel de controlo de Limites Administrativos (para usar na sidebar).
 */
export function AdminBoundaryPanel({ activeLevels, setActiveLevels, nameFilter, setNameFilter }) {
  const [inputValue, setInputValue] = useState(nameFilter || '');
  const debounceRef = useRef(null);

  const toggleLevel = (level) => {
    setActiveLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
  };

  const handleNameInput = (e) => {
    const val = e.target.value;
    setInputValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setNameFilter(val), 500);
  };

  const clearFilter = () => {
    setInputValue('');
    setNameFilter('');
  };

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerIcon}>🗺️</span>
        <span style={styles.headerTitle}>Limites Administrativos</span>
        <span style={styles.headerSub}>FAO GAUL 2015</span>
      </div>

      {/* Toggles de nível */}
      <div style={styles.levelRow}>
        {Object.entries(LEVEL_META).map(([level, meta]) => {
          const active = activeLevels.includes(level);
          return (
            <button
              key={level}
              onClick={() => toggleLevel(level)}
              style={{
                ...styles.levelBtn,
                background: active ? meta.color : 'rgba(255,255,255,0.06)',
                color: active ? '#fff' : 'rgba(255,255,255,0.55)',
                borderColor: active ? meta.color : 'rgba(255,255,255,0.12)',
              }}
              title={`Activar/desactivar ${meta.label}`}
            >
              <span style={styles.levelDot(active, meta.color)} />
              <span style={styles.levelShort}>{meta.shortLabel}</span>
              <span style={styles.levelFull}>{meta.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filtro por nome */}
      <div style={styles.searchWrap}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          type="text"
          placeholder="Filtrar por nome do admin…"
          value={inputValue}
          onChange={handleNameInput}
          style={styles.searchInput}
        />
        {inputValue && (
          <button onClick={clearFilter} style={styles.clearBtn} title="Limpar">✕</button>
        )}
      </div>

      {/* Legenda */}
      {activeLevels.length > 0 && (
        <div style={styles.legend}>
          {activeLevels.map(level => (
            <div key={level} style={styles.legendRow}>
              <span style={{ ...styles.legendDot, background: LEVEL_META[level].color }} />
              <span style={styles.legendLabel}>{LEVEL_META[level].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  panel: {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 10,
    border: '1px solid rgba(255,255,255,0.08)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerIcon: { fontSize: 14 },
  headerTitle: { fontSize: 12, fontWeight: 600, color: '#fff', flex: 1 },
  headerSub: { fontSize: 9, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  levelRow: {
    display: 'flex',
    gap: 6,
    marginBottom: 10,
    flexWrap: 'wrap',
  },
  levelBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    border: '1px solid',
    borderRadius: 6,
    padding: '5px 10px',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    transition: 'all 0.2s ease',
    flex: 1,
    minWidth: 90,
    justifyContent: 'center',
  },
  levelDot: (active, color) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: active ? '#fff' : color,
    flexShrink: 0,
  }),
  levelShort: { fontFamily: 'monospace', fontSize: 10 },
  levelFull: { fontSize: 10 },

  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(255,255,255,0.07)',
    borderRadius: 7,
    padding: '4px 8px',
    gap: 6,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  searchIcon: { fontSize: 11, opacity: 0.5 },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    fontSize: 11,
    flex: 1,
    minWidth: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    fontSize: 11,
    padding: 0,
    lineHeight: 1,
  },

  legend: {
    marginTop: 8,
    display: 'flex',
    gap: 10,
    flexWrap: 'wrap',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 3,
    borderRadius: 2,
    display: 'inline-block',
  },
  legendLabel: { fontSize: 10, color: 'rgba(255,255,255,0.5)' },
};
