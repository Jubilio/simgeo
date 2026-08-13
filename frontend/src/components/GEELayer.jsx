import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

// Configuração padrão para TileLayers GEE com rate limiting
const GEE_TILE_CONFIG = {
  minZoom: 0,
  maxZoom: 14,       // Reduzido para evitar excesso de pedidos em zoom alto
  tileSize: 256,
  maxRequests: 2,    // Máximo de 2 pedidos simultâneos
  maxCacheSize: 100, // Cache de 100 tiles
  refinementStrategy: 'no-overlap',
};

function makeGEETileLayer(id, tileUrl, opacity = 0.75) {
  if (!tileUrl) return null;
  return new TileLayer({
    ...GEE_TILE_CONFIG,
    id,
    data: tileUrl,
    opacity,
    onTileError: (err) => {
      if (err?.status === 429) {
        console.warn(`GEE rate limit (429) para ${id}. Aguardar e tentar novamente.`);
      }
    },
    renderSubLayers: props => {
      const { bbox: { west, south, east, north } } = props.tile;
      return new BitmapLayer(props, {
        data: null,
        image: props.data,
        bounds: [west, south, east, north]
      });
    }
  });
}

export default function useGEELayer({ 
  activeFlood, waterLevel, 
  activeLULC, 
  activeLithology, lithologyType, 
  activeGroundwater, gwYear, gwMonth,
  activeMalaria, malariaStartYear, malariaEndYear, malariaMonth,
  setErrorMessage 
}) {
  const [floodTileUrl, setFloodTileUrl] = useState(null);
  const [lulcTileUrl, setLulcTileUrl] = useState(null);
  const [lithologyTileUrl, setLithologyTileUrl] = useState(null);
  const [groundwaterTileUrl, setGroundwaterTileUrl] = useState(null);
  const [malariaTileUrl, setMalariaTileUrl] = useState(null);

  const abortRefs = useRef({});

  function fetchGEE(key, url, setter) {
    if (abortRefs.current[key]) {
      abortRefs.current[key].abort();
    }
    const controller = new AbortController();
    abortRefs.current[key] = controller;
    setter(null);
    axios.get(url, { signal: controller.signal })
      .then(res => {
        const tileUrl = res.data?.gee_layer?.tile_url;
        if (tileUrl) setter(tileUrl);
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.warn(`Aviso GEE (${key}):`, err);
        const detail = err.response?.data?.detail || err.response?.data?.error || 'Erro ao carregar camada GEE.';
        setErrorMessage(detail);
      });
  }

  useEffect(() => {
    if (activeFlood) {
      setErrorMessage(null);
      fetchGEE('flood', `${API_BASE}simulation/gee/flood/?water_level=${waterLevel}`, setFloodTileUrl);
    } else {
      setFloodTileUrl(null);
    }
  }, [activeFlood, waterLevel]);

  useEffect(() => {
    if (activeLULC) {
      setErrorMessage(null);
      fetchGEE('lulc', `${API_BASE}simulation/gee/lulc/`, setLulcTileUrl);
    } else {
      setLulcTileUrl(null);
    }
  }, [activeLULC]);

  useEffect(() => {
    if (activeLithology) {
      setErrorMessage(null);
      fetchGEE('lithology', `${API_BASE}simulation/gee/lithology/?mineral_type=${lithologyType}`, setLithologyTileUrl);
    } else {
      setLithologyTileUrl(null);
    }
  }, [activeLithology, lithologyType]);

  useEffect(() => {
    if (activeGroundwater) {
      setErrorMessage(null);
      fetchGEE('groundwater', `${API_BASE}simulation/gee/groundwater/map/?year=${gwYear}&month=${gwMonth}`, setGroundwaterTileUrl);
    } else {
      setGroundwaterTileUrl(null);
    }
  }, [activeGroundwater, gwYear, gwMonth]);

  useEffect(() => {
    if (activeMalaria) {
      setErrorMessage(null);
      const params = new URLSearchParams({ start_year: malariaStartYear, end_year: malariaEndYear, month: malariaMonth });
      fetchGEE('malaria', `${API_BASE}simulation/gee/malaria-suitability/?${params}`, setMalariaTileUrl);
    } else {
      setMalariaTileUrl(null);
    }
  }, [activeMalaria, malariaStartYear, malariaEndYear, malariaMonth]);

  const layers = [
    makeGEETileLayer(`gee-malaria-${malariaStartYear}-${malariaEndYear}-${malariaMonth}`, activeMalaria ? malariaTileUrl : null, 0.76),
    makeGEETileLayer(`gee-lithology-${lithologyType}`, activeLithology ? lithologyTileUrl : null, 0.7),
    makeGEETileLayer(`gee-groundwater-${gwYear}-${gwMonth}`, activeGroundwater ? groundwaterTileUrl : null, 0.7),
    makeGEETileLayer('gee-lulc', activeLULC ? lulcTileUrl : null, 0.5),
    makeGEETileLayer('gee-flood', activeFlood ? floodTileUrl : null, 0.8),
  ].filter(Boolean);

  return layers;
}
