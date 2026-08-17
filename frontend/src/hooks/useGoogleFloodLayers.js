import { useMemo } from 'react';
import { GeoJsonLayer } from '@deck.gl/layers';

const severityColor = severity => {
  if (severity === 'EXTREME') return [244, 63, 94, 150];
  if (severity === 'SEVERE') return [249, 115, 22, 135];
  if (severity === 'ABOVE_NORMAL') return [250, 204, 21, 115];
  return [34, 211, 238, 110];
};

const fillColor = feature => {
  const properties = feature.properties || {};
  if (properties.alert_type === 'flash_flood') {
    if (properties.likelihood === 'HIGHLY_LIKELY') return [244, 63, 94, 120];
    if (properties.likelihood === 'LIKELY') return [251, 146, 60, 90];
    return [251, 191, 36, 65];
  }
  if (properties.alert_type === 'significant_event') return [217, 70, 239, 90];
  return severityColor(properties.severity);
};

const lineColor = feature => {
  const [red, green, blue] = fillColor(feature);
  return [red, green, blue, 235];
};

export default function useGoogleFloodLayers({
  active,
  featureCollection,
  setTooltipInfo,
}) {
  return useMemo(() => {
    if (!active || !featureCollection?.features?.length) return [];
    return [new GeoJsonLayer({
      id: 'google-flood-live-forecast',
      data: featureCollection,
      pickable: true,
      stroked: true,
      filled: true,
      pointType: 'circle',
      lineWidthMinPixels: 2,
      getLineWidth: 2,
      getFillColor: fillColor,
      getLineColor: lineColor,
      getPointRadius: 9,
      pointRadiusUnits: 'pixels',
      getPointRadiusMinPixels: 7,
      getPointRadiusMaxPixels: 14,
      onHover: info => {
        const properties = info.object?.properties;
        if (!properties) {
          setTooltipInfo(null);
          return;
        }
        const typeLabel = properties.alert_type === 'flash_flood'
          ? 'Cheia rápida prevista'
          : properties.alert_type === 'significant_event'
            ? 'Evento significativo'
            : 'Previsão fluvial';
        setTooltipInfo({
          x: info.x,
          y: info.y,
          title: typeLabel,
          subtitle: properties.severity_label
            || properties.likelihood?.replaceAll('_', ' ')
            || properties.gauge_id,
          detail: properties.quality_verified === false
            ? 'Qualidade ainda não verificada'
            : 'Google Flood Forecasting',
        });
      },
      updateTriggers: {
        getFillColor: [featureCollection],
        getLineColor: [featureCollection],
      },
    })];
  }, [active, featureCollection, setTooltipInfo]);
}
