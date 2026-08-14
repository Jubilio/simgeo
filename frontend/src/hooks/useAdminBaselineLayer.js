import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

import { API_BASE_URL } from '../config';


const TILE_CONFIG = {
  minZoom: 0,
  maxZoom: 14,
  tileSize: 256,
  maxRequests: 2,
  maxCacheSize: 120,
  refinementStrategy: 'no-overlap',
};


export default function useAdminBaselineLayer({ active, level, indicator }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    abortRef.current?.abort();
    if (!active) {
      setLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    setData(null);

    axios.get(`${API_BASE_URL}simulation/admin-baseline/`, {
      params: { level, indicator, include_map: true },
      signal: controller.signal,
    })
      .then(response => {
        const payload = response.data?.data;
        setData(payload || null);
        if (payload?.map_error) setError(payload.map_error);
      })
      .catch(requestError => {
        if (axios.isCancel(requestError)) return;
        setData(null);
        setError(requestError.response?.data?.error || requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [active, indicator, level, reloadToken]);

  const layer = useMemo(() => {
    const tileUrl = active ? data?.gee_layer?.tile_url : null;
    if (!tileUrl) return null;
    return new TileLayer({
      ...TILE_CONFIG,
      id: `ocha-baseline-${level}-${indicator}`,
      data: tileUrl,
      opacity: 0.74,
      renderSubLayers: properties => {
        const { bbox: { west, south, east, north } } = properties.tile;
        return new BitmapLayer(properties, {
          data: null,
          image: properties.data,
          bounds: [west, south, east, north],
        });
      },
    });
  }, [active, data, indicator, level]);

  return {
    data,
    layer,
    loading,
    error,
    retry: () => setReloadToken(token => token + 1),
  };
}
