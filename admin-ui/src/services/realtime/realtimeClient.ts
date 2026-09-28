// admin-ui/src/services/realtime/realtimeClient.ts
import { useEffect } from 'react';
import { adminEventBus } from './eventEmitter';
import type { AdminEventMap, AdminEventType } from '../../types/events.types';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

class AdminRealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts = 0;
  private _status: ConnectionStatus = 'disconnected';
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus): void {
    if (this._status !== status) {
      this._status = status;
      this.statusListeners.forEach((fn) => {
        try {
          fn(status);
        } catch (err) {
          console.error('[AdminRealtimeClient] Error in status listener:', err);
        }
      });
    }
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this._status);
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Connects to the WebSocket gateway with role=admin to join room:admin.
   * Singleton protected: ignores redundant calls if already CONNECTING or OPEN.
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    let baseUrl = import.meta.env.VITE_API_URL || '';
    if (!baseUrl) {
      baseUrl = `${window.location.protocol}//${window.location.host}`;
    }
    const wsProtocol = baseUrl.startsWith('https') ? 'wss:' : 'ws:';
    const wsHost = baseUrl.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '');

    const params = new URLSearchParams({ role: 'admin' });
    const url = `${wsProtocol}//${wsHost}/events?${params.toString()}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[AdminRealtimeClient] Failed to instantiate WebSocket:', err);
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setStatus('connected');
    };

    this.ws.onmessage = (messageEvent) => {
      try {
        const payload = JSON.parse(messageEvent.data);
        const eventName = payload.event as AdminEventType;
        const eventData = payload.data;

        if (eventName) {
          adminEventBus.emit(eventName, eventData);
        }
      } catch (err) {
        console.error('[AdminRealtimeClient] Failed to parse message packet:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[AdminRealtimeClient] WebSocket encountered network error:', err);
    };

    this.ws.onclose = () => {
      this.ws = null;
      this.setStatus('disconnected');
      this.scheduleReconnect();
    };
  }

  /**
   * Reconnects with exponential backoff and random jitter.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
    }

    this.reconnectAttempts++;
    const baseDelay = Math.min(15000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    const jitter = Math.random() * 1000;
    const delay = Math.round(baseDelay + jitter);

    this.setStatus('reconnecting');
    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }
}

export const realtimeClient = new AdminRealtimeClient();

/**
 * React hook for subscribing to realtime admin events with automatic cleanup on unmount.
 */
export function useRealtimeEvent<K extends AdminEventType>(
  event: K,
  handler: (data: AdminEventMap[K]) => void
): void {
  useEffect(() => {
    const unsubscribe = adminEventBus.on(event, handler);
    return () => {
      unsubscribe();
    };
  }, [event, handler]);
}
