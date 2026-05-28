import { useEffect, useRef } from 'react';
import API_CONFIG from '../config/api';

export function useRealtimeRefresh(refresh, enabled = true) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.EventSource) return undefined;

    const source = new EventSource(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.events}`, {
      withCredentials: true,
    });

    const handleChange = () => {
      refreshRef.current?.();
    };

    source.addEventListener('data-change', handleChange);

    return () => {
      source.removeEventListener('data-change', handleChange);
      source.close();
    };
  }, [enabled]);
}
