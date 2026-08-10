import { useEffect, useState } from 'react';
import axios from 'axios';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';

const API_BASE = 'http://localhost:8000/api/';

export default function useMapLayers({ showBoundaries, showInfrastructure, setTooltipInfo, gwCustomPoints }) {
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

  const layers = [];

  if (showBoundaries && boundaries) {
    layers.push(
      new GeoJsonLayer({
        id: 'boundaries-layer',
        data: boundaries,
        pickable: true,
        stroked: true,
        filled: true,
        lineWidthMinPixels: 1,
        getFillColor: d => {
          const isProvince = d.properties.level === 1;
          // indigo (4f46e5 -> 79, 70, 229), violet (8b5cf6 -> 139, 92, 246)
          return isProvince ? [79, 70, 229, 25] : [139, 92, 246, 76];
        },
        getLineColor: [199, 210, 254, 255],
        getLineWidth: d => (d.properties.level === 1 ? 2 : 1),
        onHover: info => {
          if (info.object) {
            setTooltipInfo({
              x: info.x,
              y: info.y,
              title: info.object.properties.level_display,
              subtitle: info.object.properties.name
            });
          } else {
            setTooltipInfo(null);
          }
        }
      })
    );
  }

  if (showInfrastructure && infrastructure) {
    layers.push(
      new GeoJsonLayer({
        id: 'infrastructure-layer',
        data: infrastructure,
        pickable: true,
        stroked: true,
        filled: true,
        pointType: 'circle',
        getFillColor: d => {
          const type = d.properties.type;
          if (type === 'hospital') return [239, 68, 68, 230]; // red
          if (type === 'water') return [59, 130, 246, 230]; // blue
          return [16, 185, 129, 230]; // emerald
        },
        getLineColor: [255, 255, 255, 255],
        getLineWidth: 2,
        getPointRadius: 6,
        pointRadiusUnits: 'pixels',
        onHover: info => {
          if (info.object) {
            setTooltipInfo({
              x: info.x,
              y: info.y,
              title: info.object.properties.name,
              subtitle: `Tipo: ${info.object.properties.type_display}`,
              detail: `Capacidade: ${info.object.properties.capacity || 'N/A'}`
            });
          } else {
            setTooltipInfo(null);
          }
        }
      })
    );
  }

  // Camada para os Pontos Interativos GLDAS
  if (gwCustomPoints && gwCustomPoints.length > 0) {
    layers.push(
      new ScatterplotLayer({
        id: 'gw-custom-points',
        data: gwCustomPoints,
        pickable: true,
        opacity: 0.8,
        stroked: true,
        filled: true,
        radiusScale: 1000,
        radiusMinPixels: 6,
        radiusMaxPixels: 20,
        lineWidthMinPixels: 2,
        getPosition: d => [d.lng, d.lat],
        getFillColor: [255, 204, 0, 255], // Amarelo
        getLineColor: [255, 255, 255, 255],
        onHover: info => {
          if (info.object) {
            setTooltipInfo({
              x: info.x,
              y: info.y,
              title: info.object.name,
              subtitle: 'Ponto de Monitorização GLDAS',
              detail: `[${info.object.lng}, ${info.object.lat}]`
            });
          } else {
            setTooltipInfo(null);
          }
        }
      })
    );
  }

  return layers;
}
