import { useEffect, useState } from 'react';
import axios from 'axios';
import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

export default function useGEELayer({ active, waterLevel, setErrorMessage }) {
  const [tileUrl, setTileUrl] = useState(null);

  useEffect(() => {
    if (active) {
      setErrorMessage(null);
      // Fetch map tiles from Django backend which talks to GEE
      axios.get(`${API_BASE}simulation/gee/flood/?water_level=${waterLevel}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setTileUrl(res.data.gee_layer.tile_url);
          }
        })
        .catch(err => {
          console.warn("Aviso GEE:", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Google Earth Engine não autenticado.";
          setErrorMessage(detail);
        });
    } else {
      setTileUrl(null);
      setErrorMessage(null);
    }
  }, [active, waterLevel, setErrorMessage]);

  const layers = [];

  if (active && tileUrl) {
    layers.push(
      new TileLayer({
        id: 'gee-tile-layer',
        data: tileUrl, // Ex: https://earthengine.googleapis.com/v1/projects/.../tiles/{z}/{x}/{y}
        minZoom: 0,
        maxZoom: 19,
        tileSize: 256,
        opacity: 0.7,
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
