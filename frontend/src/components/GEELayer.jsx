import { useEffect, useState } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

export default function useGEELayer({ 
  activeFlood, waterLevel, 
  activeLULC, 
  activeLithology, lithologyType, 
  activeGroundwater, gwYear, gwMonth,
  setErrorMessage 
}) {
  const [floodTileUrl, setFloodTileUrl] = useState(null);
  const [lulcTileUrl, setLulcTileUrl] = useState(null);
  const [lithologyTileUrl, setLithologyTileUrl] = useState(null);
  const [groundwaterTileUrl, setGroundwaterTileUrl] = useState(null);

  // Hook para Inundação
  useEffect(() => {
    if (activeFlood) {
      setErrorMessage(null);
      axios.get(`${API_BASE}simulation/gee/flood/?water_level=${waterLevel}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setFloodTileUrl(res.data.gee_layer.tile_url);
          }
        })
        .catch(err => {
          console.warn("Aviso GEE (Flood):", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Google Earth Engine não autenticado.";
          setErrorMessage(detail);
        });
    } else {
      setFloodTileUrl(null);
    }
  }, [activeFlood, waterLevel, setErrorMessage]);

  // Hook para LULC
  useEffect(() => {
    if (activeLULC) {
      setErrorMessage(null);
      axios.get(`${API_BASE}simulation/gee/lulc/`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setLulcTileUrl(res.data.gee_layer.tile_url);
          }
        })
        .catch(err => {
          console.warn("Aviso GEE (LULC):", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Google Earth Engine não autenticado.";
          setErrorMessage(detail);
        });
    } else {
      setLulcTileUrl(null);
    }
  }, [activeLULC, setErrorMessage]);

  // Hook para Lithology
  useEffect(() => {
    if (activeLithology) {
      setErrorMessage(null);
      axios.get(`${API_BASE}simulation/gee/lithology/?mineral_type=${lithologyType}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setLithologyTileUrl(res.data.gee_layer.tile_url);
          }
        })
        .catch(err => {
          console.warn("Aviso GEE (Lithology):", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Google Earth Engine não autenticado.";
          setErrorMessage(detail);
        });
    } else {
      setLithologyTileUrl(null);
    }
  }, [activeLithology, lithologyType, setErrorMessage]);

  // Hook para Águas Subterrâneas (GLDAS)
  useEffect(() => {
    if (activeGroundwater) {
      setErrorMessage(null);
      axios.get(`${API_BASE}simulation/gee/groundwater/map/?year=${gwYear}&month=${gwMonth}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setGroundwaterTileUrl(res.data.gee_layer.tile_url);
          }
        })
        .catch(err => {
          console.warn("Aviso GEE (Groundwater):", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Erro ao carregar dados do GLDAS.";
          setErrorMessage(detail);
        });
    } else {
      setGroundwaterTileUrl(null);
    }
  }, [activeGroundwater, gwYear, gwMonth, setErrorMessage]);

  const layers = [];

  // 1. Renderizar Lithology (ASTER) primeiro
  if (activeLithology && lithologyTileUrl) {
    layers.push(
      new TileLayer({
        id: `gee-lithology-layer-${lithologyType}`,
        data: lithologyTileUrl,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.7, // 70% opacity
        renderSubLayers: props => {
          const {
            bbox: { west, south, east, north }
          } = props.tile;

          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      })
    );
  }

  // 1.5 Renderizar Águas Subterrâneas (GLDAS)
  if (activeGroundwater && groundwaterTileUrl) {
    layers.push(
      new TileLayer({
        id: `gee-groundwater-layer-${gwYear}-${gwMonth}`,
        data: groundwaterTileUrl,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.7,
        renderSubLayers: props => {
          const { bbox: { west, south, east, north } } = props.tile;
          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      })
    );
  }

  // 2. Renderizar LULC (fica por baixo da água, cima da litologia)
  if (activeLULC && lulcTileUrl) {
    layers.push(
      new TileLayer({
        id: 'gee-lulc-layer',
        data: lulcTileUrl,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.5, // 50% opacity para ver o basemap por baixo
        renderSubLayers: props => {
          const {
            bbox: { west, south, east, north }
          } = props.tile;

          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      })
    );
  }

  // 3. Renderizar a Inundação (por cima)
  if (activeFlood && floodTileUrl) {
    layers.push(
      new TileLayer({
        id: 'gee-flood-layer',
        data: floodTileUrl,
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.8,
        renderSubLayers: props => {
          const {
            bbox: { west, south, east, north }
          } = props.tile;

          return new BitmapLayer(props, {
            data: null,
            image: props.data,
            bounds: [west, south, east, north]
          });
        }
      })
    );
  }

  return layers;
}
