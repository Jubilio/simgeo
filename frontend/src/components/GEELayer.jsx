import { useEffect, useState } from 'react';
import axios from 'axios';
import { TileLayer } from 'react-leaflet';

const API_BASE = 'http://localhost:8000/api/';

export default function GEELayer({ active, waterLevel }) {
  const [tileUrl, setTileUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (active) {
      setLoading(true);
      setErrorMessage(null);
      // Fetch map tiles from Django backend which talks to GEE
      axios.get(`${API_BASE}simulation/gee/flood/?water_level=${waterLevel}`)
        .then(res => {
          if (res.data && res.data.gee_layer && res.data.gee_layer.tile_url) {
            setTileUrl(res.data.gee_layer.tile_url);
          }
          setLoading(false);
        })
        .catch(err => {
          console.warn("Aviso GEE:", err);
          const detail = err.response?.data?.detail || err.response?.data?.error || "Google Earth Engine não autenticado.";
          setErrorMessage(detail);
          setLoading(false);
        });
    } else {
      setTileUrl(null);
      setErrorMessage(null);
    }
  }, [active, waterLevel]);

  return (
    <>
      {active && tileUrl && (
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://earthengine.google.com/">Google Earth Engine</a>'
          opacity={0.7}
          zIndex={100}
        />
      )}

      {active && errorMessage && (
        <div className="leaflet-bottom leaflet-left" style={{ pointerEvents: 'auto', margin: '20px', zIndex: 1000 }}>
          <div className="bg-slate-900/90 backdrop-blur-md border border-amber-500/50 p-4 rounded-xl shadow-xl max-w-sm text-xs text-amber-200 space-y-1">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
              Google Earth Engine Requer Autenticação
            </div>
            <p className="text-slate-300">{errorMessage}</p>
          </div>
        </div>
      )}
    </>
  );
}
