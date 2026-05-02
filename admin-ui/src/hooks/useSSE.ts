// src/hooks/useSSE.ts
import { useEffect, useRef } from 'react';
import { useAdminStore } from '../stores/useAdminStore';
import { useUserPrintStore } from '../stores/useUserPrintStore';
import type { SSEEvent } from '../types';

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const connectSSE = () => {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      // We append a timestamp or use credentials if needed. 
      // EventSource doesn't support custom headers (like Authorization) out of the box in browsers,
      // so if auth is required, we'd append `?token=${localStorage.getItem('auth_token')}`
      // For now, assuming SSE endpoint is open or uses cookie auth based on backend implementation.
      const url = `${baseUrl}/events`;
      
      const source = new EventSource(url);
      eventSourceRef.current = source;

      source.onmessage = (event) => {
        try {
          const parsed: SSEEvent = JSON.parse(event.data);
          
          // Dispatch to Admin Store
          const adminState = useAdminStore.getState();
          if (adminState.handleSSEEvent) {
             adminState.handleSSEEvent(parsed);
          }

          // Dispatch to User Print Store
          const userState = useUserPrintStore.getState();
          if (userState.handleSSEEvent) {
             userState.handleSSEEvent(parsed);
          }

        } catch (e) {
          console.error("Failed to parse SSE message", e);
        }
      };

      source.onerror = (err) => {
        console.error("SSE connection error", err);
        source.close();
        // Auto-reconnect after 3 seconds
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);
}
