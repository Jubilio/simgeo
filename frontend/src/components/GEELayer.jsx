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
  activeCyclone, cycloneStart, cycloneEnd, cycloneLayerType,
  floodImpactTileUrl,
  setErrorMessage 
}) {
  const [floodTileUrl, setFloodTileUrl] = useState(null);
  const [lulcTileUrl, setLulcTileUrl] = useState(null);
  const [lithologyTileUrl, setLithologyTileUrl] = useState(null);
  const [groundwaterTileUrl, setGroundwaterTileUrl] = useState(null);
  const [malariaTileUrl, setMalariaTileUrl] = useState(null);
  const [cycloneTileUrl, setCycloneTileUrl] = useState(null);

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
      const params = new URLSearchParams({
        start_year: malariaStartYear,
        end_year: malariaEndYear,
        month: malariaMonth
      });
      fetchGEE('malaria', `${API_BASE}simulation/gee/malaria-suitability/?${params}`, setMalariaTileUrl);
    } else {
      if (abortRefs.current.malaria) abortRefs.current.malaria.abort();
      setMalariaTileUrl(null);
    }
  }, [activeMalaria, malariaStartYear, malariaEndYear, malariaMonth]);

  // Cyclone has its own useEffect so it ONLY fires when cyclone-specific props change
  useEffect(() => {
    if (activeCyclone) {
      const params = new URLSearchParams({
        start_date: cycloneStart,
        end_date: cycloneEnd,
        type: cycloneLayerType
      });
      fetchGEE('cyclone', `${API_BASE}simulation/gee/cyclone/?${params}`, setCycloneTileUrl);
    } else {
      if (abortRefs.current.cyclone) abortRefs.current.cyclone.abort();
      setCycloneTileUrl(null);
    }
  }, [activeCyclone, cycloneStart, cycloneEnd, cycloneLayerType]);

  const layers = [
    makeGEETileLayer('gee-flood-layer', activeFlood ? floodTileUrl : null, 0.8),
    makeGEETileLayer('gee-lulc-layer', activeLULC ? lulcTileUrl : null, 0.85),
    makeGEETileLayer('gee-lithology-layer', activeLithology ? lithologyTileUrl : null, 0.7),
    makeGEETileLayer('gee-groundwater-layer', activeGroundwater ? groundwaterTileUrl : null, 0.65),
    makeGEETileLayer('gee-malaria-layer', activeMalaria ? malariaTileUrl : null, 0.8),
    makeGEETileLayer('gee-cyclone-layer', activeCyclone ? cycloneTileUrl : null, 0.8),
    makeGEETileLayer('gee-flood-impact-layer', floodImpactTileUrl, 0.75),
  ].filter(Boolean);

  return layers;
}
