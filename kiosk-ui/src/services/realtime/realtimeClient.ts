// kiosk-ui/src/services/realtime/realtimeClient.ts
import { useEffect } from 'react';
import { kioskEventBus } from './eventEmitter';
import type { KioskDomainEventMap, KioskEventName } from '../../types/events.types';

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

class KioskRealtimeClient {
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
          console.error('[KioskRealtimeClient] Error in status listener:', err);
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
   * Connects to the WebSocket gateway with role=kiosk.
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

    const params = new URLSearchParams({ role: 'kiosk' });
    const url = `${wsProtocol}//${wsHost}/events?${params.toString()}`;

    try {
      this.ws = new WebSocket(url);
    } catch (err) {
      console.error('[KioskRealtimeClient] Failed to instantiate WebSocket:', err);
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
        const eventName = payload.event as KioskEventName;
        const eventData = payload.data;

        if (eventName) {
          kioskEventBus.emit(eventName, eventData);
        }
      } catch (err) {
        console.error('[KioskRealtimeClient] Failed to parse message packet:', err);
      }
    };

    this.ws.onerror = (err) => {
      console.warn('[KioskRealtimeClient] WebSocket encountered network error:', err);
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

export const realtimeClient = new KioskRealtimeClient();

/**
 * React hook for subscribing to realtime events with automatic cleanup on unmount.
 */
export function useRealtimeEvent<K extends KioskEventName>(
  event: K,
  handler: (data: KioskDomainEventMap[K]) => void
): void {
  useEffect(() => {
    const unsubscribe = kioskEventBus.on(event, handler);
    return () => {
      unsubscribe();
    };
  }, [event, handler]);
}
