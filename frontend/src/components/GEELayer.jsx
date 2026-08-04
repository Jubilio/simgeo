import { useEffect, useState } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

export default function useGEELayer({ activeFlood, waterLevel, activeLULC, activeLithology, lithologyType, setErrorMessage }) {
  const [floodTileUrl, setFloodTileUrl] = useState(null);
  const [lulcTileUrl, setLulcTileUrl] = useState(null);
  const [lithologyTileUrl, setLithologyTileUrl] = useState(null);

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

  const layers = [];

  // 1. Renderizar LULC primeiro (fica por baixo da água)
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
