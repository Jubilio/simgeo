import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

import { API_BASE_URL } from '../config';

const ADMIN_LABELS = {
  level1: 'Províncias',
  level2: 'Distritos',
};

const TILE_CONFIG = {
  minZoom: 0,
  maxZoom: 14,
  tileSize: 256,
  maxRequests: 2,
  maxCacheSize: 150,
  refinementStrategy: 'no-overlap',
};

export default function useAdminBoundaryLayers({
  activeLevels,
  nameFilter,
  country = 'Mozambique',
  setErrorMessage,
}) {
  const [tileUrls, setTileUrls] = useState({ level1: null, level2: null });
  const abortRefs = useRef({});

  const fetchLevel = useCallback((level) => {
    abortRefs.current[level]?.abort();
    const controller = new AbortController();
    abortRefs.current[level] = controller;

    setTileUrls(previous => ({ ...previous, [level]: null }));
    setErrorMessage?.(null);

    const params = new URLSearchParams({ level, country });
    const normalizedFilter = (nameFilter || '').trim();
    if (normalizedFilter.length > 1) {
      params.set('name_filter', normalizedFilter);
    }

    axios
      .get(`${API_BASE_URL}simulation/gee/admin-boundaries/?${params}`, {
        signal: controller.signal,
      })
      .then(response => {
        const url = response.data?.gee_layer?.tile_url;
        if (url) {
          setTileUrls(previous => ({ ...previous, [level]: url }));
        }
      })
      .catch(error => {
        if (axios.isCancel(error)) return;
        console.warn(`GAUL ${level} error:`, error);
        setErrorMessage?.(
          `Erro ao carregar ${ADMIN_LABELS[level]}: ${error.response?.data?.error || error.message}`,
        );
      });
  }, [country, nameFilter, setErrorMessage]);

  useEffect(() => {
    ['level1', 'level2'].forEach(level => {
      if (activeLevels.includes(level)) {
        fetchLevel(level);
      } else {
        abortRefs.current[level]?.abort();
        delete abortRefs.current[level];
        setTileUrls(previous => ({ ...previous, [level]: null }));
      }
    });

    const activeControllers = Object.values(abortRefs.current);
    return () => {
      activeControllers.forEach(controller => controller.abort());
    };
  }, [activeLevels, fetchLevel]);

  const layers = ['level1', 'level2']
    .filter(level => activeLevels.includes(level) && tileUrls[level])
    .map(level => new TileLayer({
      ...TILE_CONFIG,
      id: `gaul-${level}-${nameFilter || 'all'}`,
      data: tileUrls[level],
      opacity: 0.9,
      renderSubLayers: properties => {
        const { bbox: { west, south, east, north } } = properties.tile;
        return new BitmapLayer(properties, {
          data: null,
          image: properties.data,
          bounds: [west, south, east, north],
        });
      },
    }));

  return { layers, tileUrls };
}
