import { useEffect, useState } from 'react';
import axios from 'axios';
import { TileLayer } from 'react-leaflet';

const API_BASE = 'http://localhost:8000/api/';

export default function GEELayer({ active, waterLevel }) {
  const [tileUrl, setTileUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (active) {
      setLoading(true);
      setError(null);
      // Fetch map tiles from Django backend which talks to GEE
      axios.get(`${API_BASE}simulation/gee/flood/?water_level=${waterLevel}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setTileUrl(res.data.gee_layer.tile_url);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error("Erro ao carregar GEE Tiles:", err);
          setError("Falha ao comunicar com o Earth Engine.");
          setLoading(false);
        });
    } else {
      setTileUrl(null);
    }
  }, [active, waterLevel]);

  if (!active || !tileUrl) return null;

  return (
    <TileLayer
      url={tileUrl}
      attribution='&copy; <a href="https://earthengine.google.com/">Google Earth Engine</a>'
      opacity={0.7}
      zIndex={100}
    />
  );
}
