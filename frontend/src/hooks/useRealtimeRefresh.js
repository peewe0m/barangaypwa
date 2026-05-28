import { useEffect, useRef } from 'react';
import API_CONFIG from '../config/api';

export function useRealtimeRefresh(refresh, enabled = true) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.EventSource) return undefined;

    // EventSource in browsers does NOT support `withCredentials`.
    // Use Authorization header instead (we rely on the HttpOnly cookie being readable server-side).
    // If your backend only checks cookies, this will still work only when credentials cookies are sent.
    const source = new EventSource(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.events}`);

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
