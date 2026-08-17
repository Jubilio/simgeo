import { useCallback, useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

import { API_BASE_URL } from '../config';

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
  forestDynamicsTileUrl,
  livestockDynamicsTileUrl,
  setErrorMessage 
}) {
  const [floodTileUrl, setFloodTileUrl] = useState(null);
  const [lulcTileUrl, setLulcTileUrl] = useState(null);
  const [lithologyTileUrl, setLithologyTileUrl] = useState(null);
  const [groundwaterTileUrl, setGroundwaterTileUrl] = useState(null);
  const [malariaTileUrl, setMalariaTileUrl] = useState(null);
  const [cycloneTileUrl, setCycloneTileUrl] = useState(null);

  const abortRefs = useRef({});

  const fetchGEE = useCallback((key, url, setter) => {
    if (abortRefs.current[key]) {
      abortRefs.current[key].abort();
    }
    const controller = new AbortController();
    abortRefs.current[key] = controller;
    setter(null);
    setErrorMessage?.(null);
    axios.get(url, { signal: controller.signal })
      .then(res => {
        const tileUrl = res.data?.gee_layer?.tile_url;
        if (tileUrl) setter(tileUrl);
      })
      .catch(err => {
        if (axios.isCancel(err)) return;
        console.warn(`Aviso GEE (${key}):`, err);
        const detail = err.response?.data?.detail || err.response?.data?.error || 'Erro ao carregar camada GEE.';
        setErrorMessage?.(detail);
      });
  }, [setErrorMessage]);

  const cancelRequest = useCallback((key, setter) => {
    abortRefs.current[key]?.abort();
    delete abortRefs.current[key];
    setter(null);
  }, []);

  useEffect(() => () => {
    Object.values(abortRefs.current).forEach(controller => controller.abort());
  }, []);

  useEffect(() => {
    if (activeFlood) {
      fetchGEE('flood', `${API_BASE_URL}simulation/gee/flood/?water_level=${waterLevel}`, setFloodTileUrl);
    } else {
      cancelRequest('flood', setFloodTileUrl);
    }
  }, [activeFlood, waterLevel, cancelRequest, fetchGEE]);

  useEffect(() => {
    if (activeLULC) {
      fetchGEE('lulc', `${API_BASE_URL}simulation/gee/lulc/`, setLulcTileUrl);
    } else {
      cancelRequest('lulc', setLulcTileUrl);
    }
  }, [activeLULC, cancelRequest, fetchGEE]);

  useEffect(() => {
    if (activeLithology) {
      fetchGEE('lithology', `${API_BASE_URL}simulation/gee/lithology/?mineral_type=${lithologyType}`, setLithologyTileUrl);
    } else {
      cancelRequest('lithology', setLithologyTileUrl);
    }
  }, [activeLithology, lithologyType, cancelRequest, fetchGEE]);

  useEffect(() => {
    if (activeGroundwater) {
      fetchGEE('groundwater', `${API_BASE_URL}simulation/gee/groundwater/map/?year=${gwYear}&month=${gwMonth}`, setGroundwaterTileUrl);
    } else {
      cancelRequest('groundwater', setGroundwaterTileUrl);
    }
  }, [activeGroundwater, gwYear, gwMonth, cancelRequest, fetchGEE]);

  useEffect(() => {
    if (activeMalaria) {
      const params = new URLSearchParams({
        start_year: malariaStartYear,
        end_year: malariaEndYear,
        month: malariaMonth
      });
      fetchGEE('malaria', `${API_BASE_URL}simulation/gee/malaria-suitability/?${params}`, setMalariaTileUrl);
    } else {
      cancelRequest('malaria', setMalariaTileUrl);
    }
  }, [activeMalaria, malariaStartYear, malariaEndYear, malariaMonth, cancelRequest, fetchGEE]);

  // Cyclone has its own useEffect so it ONLY fires when cyclone-specific props change
  useEffect(() => {
    if (activeCyclone) {
      const params = new URLSearchParams({
        start_date: cycloneStart,
        end_date: cycloneEnd,
        type: cycloneLayerType
      });
      fetchGEE('cyclone', `${API_BASE_URL}simulation/gee/cyclone/?${params}`, setCycloneTileUrl);
    } else {
      cancelRequest('cyclone', setCycloneTileUrl);
    }
  }, [activeCyclone, cycloneStart, cycloneEnd, cycloneLayerType, cancelRequest, fetchGEE]);

  const layers = [
    makeGEETileLayer('gee-flood-layer', activeFlood ? floodTileUrl : null, 0.8),
    makeGEETileLayer('gee-lulc-layer', activeLULC ? lulcTileUrl : null, 0.85),
    makeGEETileLayer('gee-lithology-layer', activeLithology ? lithologyTileUrl : null, 0.7),
    makeGEETileLayer('gee-groundwater-layer', activeGroundwater ? groundwaterTileUrl : null, 0.65),
    makeGEETileLayer('gee-malaria-layer', activeMalaria ? malariaTileUrl : null, 0.8),
    makeGEETileLayer('gee-cyclone-layer', activeCyclone ? cycloneTileUrl : null, 0.8),
    makeGEETileLayer('gee-flood-impact-layer', floodImpactTileUrl, 0.75),
    makeGEETileLayer('gee-forest-dynamics-layer', forestDynamicsTileUrl, 0.82),
    makeGEETileLayer('gee-livestock-dynamics-layer', livestockDynamicsTileUrl, 0.82),
  ].filter(Boolean);

  return layers;
}
