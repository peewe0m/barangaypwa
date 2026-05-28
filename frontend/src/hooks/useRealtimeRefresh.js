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
    // Cookies with EventSource are unreliable cross-origin.
    // Send Authorization header using the existing access_token cookie.
    const accessToken = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('access_token='))
      ?.split('=')[1];

    const source = new EventSource(`${API_CONFIG.baseURL}${API_CONFIG.endpoints.events}`, {
      headers: accessToken ? { Authorization: `Bearer ${decodeURIComponent(accessToken)}` } : {}
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
