import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';

import { API_BASE_URL } from '../config';

export default function useGoogleFloodForecast({ enabled }) {
  const [serviceStatus, setServiceStatus] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestVersion, setRequestVersion] = useState(0);
  const forceRefreshRef = useRef(false);

  const refresh = useCallback((force = true) => {
    forceRefreshRef.current = force;
    setRequestVersion(version => version + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const statusResponse = await axios.get(
          `${API_BASE_URL}simulation/google-floods/status/`,
          { signal: controller.signal },
        );
        if (!active) return;
        const currentStatus = statusResponse.data?.data;
        setServiceStatus(currentStatus);
        if (!currentStatus?.ready) {
          setData(null);
          return;
        }

        const forecastResponse = await axios.get(
          `${API_BASE_URL}simulation/google-floods/forecast/`,
          {
            signal: controller.signal,
            params: {
              country: 'MZ',
              include_polygons: true,
              include_context: true,
              refresh: forceRefreshRef.current,
            },
          },
        );
        if (!active) return;
        setData(forecastResponse.data?.data || null);
      } catch (requestError) {
        if (axios.isCancel(requestError) || !active) return;
        const fallback = requestError.response?.data?.fallback;
        if (fallback) setServiceStatus(fallback);
        setError(
          requestError.response?.data?.error
          || 'Não foi possível carregar as previsões Google Floods.',
        );
      } finally {
        if (active) {
          setLoading(false);
          forceRefreshRef.current = false;
        }
      }
    };

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [enabled, requestVersion]);

  return { serviceStatus, data, loading, error, refresh };
}
