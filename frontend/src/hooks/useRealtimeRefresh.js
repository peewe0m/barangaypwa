import { useEffect, useRef } from 'react';
import API_CONFIG from '../config/api';

// NOTE:
// Native EventSource cannot reliably send cookies/headers cross-origin.
// This hook uses fetch + ReadableStream to read the SSE body with `credentials: "include"`.
export function useRealtimeRefresh(refresh, enabled = true) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const controller = new AbortController();
    const url = `${API_CONFIG.baseURL}${API_CONFIG.endpoints.events}`;

    let buffer = '';
    const handleChange = () => {
      refreshRef.current?.();
    };

    fetch(url, {
      method: 'GET',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        Accept: 'text/event-stream',
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          // stop on auth failures etc.
          return;
        }

        const reader = res.body?.getReader?.();
        if (!reader) return;

        const decoder = new TextDecoder('utf-8');

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Very small SSE parser: split on double newlines between events.
          // We only care about lines like: event: data-change
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const evtLine = part.split('\n').find((l) => l.startsWith('event:'));
            const eventName = evtLine ? evtLine.replace('event:', '').trim() : '';
            if (eventName === 'data-change') {
              handleChange();
            }
          }
        }
      })
      .catch(() => {
        // ignore fetch/read errors (network reconnect not implemented)
      });

    return () => {
      controller.abort();
    };
  }, [enabled]);
}

