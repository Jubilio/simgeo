import { useEffect, useState } from 'react';
import axios from 'axios';
import { GeoJSON } from 'react-leaflet';
import L from 'leaflet';

const API_BASE = 'http://localhost:8000/api/';

export default function MapLayers({ showBoundaries, showInfrastructure }) {
  const [boundaries, setBoundaries] = useState(null);
  const [infrastructure, setInfrastructure] = useState(null);

  // Fetch Limites Administrativos
  useEffect(() => {
    if (showBoundaries && !boundaries) {
      axios.get(`${API_BASE}boundaries/`)
        .then(res => {
          const geoData = res.data.results ? res.data.results : res.data;
          setBoundaries(geoData);
        })
        .catch(err => console.error("Erro ao carregar Limites Administrativos:", err));
    }
  }, [showBoundaries, boundaries]);

  // Fetch Infraestruturas
  useEffect(() => {
    if (showInfrastructure && !infrastructure) {
      axios.get(`${API_BASE}infrastructures/`)
        .then(res => {
          const geoData = res.data.results ? res.data.results : res.data;
          setInfrastructure(geoData);
        })
        .catch(err => console.error("Erro ao carregar Infraestruturas:", err));
    }
  }, [showInfrastructure, infrastructure]);

  // Estilos para Limites Administrativos (Polígonos)
  const boundaryStyle = (feature) => {
    const isProvince = feature.properties.level === 1;
    return {
      fillColor: isProvince ? '#4f46e5' : '#8b5cf6', // indigo vs violet
      weight: isProvince ? 2 : 1,
      opacity: 1,
      color: '#c7d2fe', // border color
      fillOpacity: isProvince ? 0.1 : 0.3
    };
  };

  // Renderização Customizada para Pontos (Infraestrutura)
  const infraPointToLayer = (feature, latlng) => {
    let color = '#10b981'; // default emerald
    if (feature.properties.type === 'hospital') color = '#ef4444'; // red
    if (feature.properties.type === 'water') color = '#3b82f6'; // blue
    
    return L.circleMarker(latlng, {
      radius: 6,
      fillColor: color,
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    });
  };

  // Adicionar Popups/Tooltips a cada feature
  const onEachBoundary = (feature, layer) => {
    if (feature.properties && feature.properties.name) {
      layer.bindTooltip(`<strong>${feature.properties.level_display}</strong>: ${feature.properties.name}`, {
        sticky: true,
        className: 'bg-slate-800 text-white border-slate-700'
      });
    }
  };

  const onEachInfra = (feature, layer) => {
    if (feature.properties && feature.properties.name) {
      layer.bindPopup(`
        <div class="p-1">
          <h3 class="font-bold text-slate-800">${feature.properties.name}</h3>
          <p class="text-xs text-slate-500 mt-1">Tipo: ${feature.properties.type_display}</p>
          <p class="text-xs text-slate-500">Capacidade: ${feature.properties.capacity || 'N/A'}</p>
        </div>
      `);
    }
  };

  return (
    <>
      {showBoundaries && boundaries && (
        <GeoJSON 
          data={boundaries} 
          style={boundaryStyle}
          onEachFeature={onEachBoundary}
        />
      )}

      {showInfrastructure && infrastructure && (
        <GeoJSON 
          data={infrastructure} 
          pointToLayer={infraPointToLayer}
          onEachFeature={onEachInfra}
        />
      )}
    </>
  );
}

