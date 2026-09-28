// customer-ui/src/services/realtime/eventEmitter.ts
import type { CustomerEventMap, CustomerEventType } from '../../types/events.types';

type Listener<T> = (data: T) => void;
type AnyListener = (event: string, data: any) => void;

const DEDUPE_WINDOW_MS = 1500;

export class CustomerEventEmitter {
  private listeners = new Map<CustomerEventType, Set<Listener<any>>>();
  private anyListeners = new Set<AnyListener>();

  // Layer 1: Sliding Window Fingerprint Cache for Deduplication
  private recentFingerprints = new Map<string, number>();

  /**
   * Registers a typed event listener. Returns an instant unsubscribe function.
   */
  on<K extends CustomerEventType>(event: K, listener: Listener<CustomerEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  /**
   * Removes a registered listener.
   */
  off<K extends CustomerEventType>(event: K, listener: Listener<CustomerEventMap[K]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Registers a wildcard listener for all events.
   */
  onAny(listener: AnyListener): () => void {
    this.anyListeners.add(listener);
    return () => {
      this.anyListeners.delete(listener);
    };
  }

  /**
   * Dispatches an event to all subscribers with Layer 1 Deduplication protection.
   */
  emit<K extends CustomerEventType>(event: K, data: CustomerEventMap[K]): boolean {
    const now = Date.now();
    this.pruneOldFingerprints(now);

    // Compute fingerprint to prevent rapid duplicate bursts
    const fingerprint = this.computeFingerprint(event, data);
    if (fingerprint) {
      const lastSeen = this.recentFingerprints.get(fingerprint);
      if (lastSeen && now - lastSeen < DEDUPE_WINDOW_MS) {
        // Drop duplicate packet within the sliding window
        return false;
      }
      this.recentFingerprints.set(fingerprint, now);
    }

    // 1. Notify typed listeners
    const handlers = this.listeners.get(event);
    if (handlers && handlers.size > 0) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[CustomerEventEmitter] Error in listener for event "${event}":`, err);
        }
      });
    }

    // 2. Notify wildcard listeners
    if (this.anyListeners.size > 0) {
      this.anyListeners.forEach((handler) => {
        try {
          handler(event, data);
        } catch (err) {
          console.error(`[CustomerEventEmitter] Error in wildcard listener for event "${event}":`, err);
        }
      });
    }

    return true;
  }

  /**
   * Computes a unique signature for the event payload.
   */
  private computeFingerprint(event: CustomerEventType, data: any): string | null {
    // Handshake events are always allowed
    if (event === 'connected') return null;

    if (data && typeof data === 'object') {
      const id = data.id || data.quoteId || '';
      const status = data.status || data.data?.status || data.reason || '';
      const progress = typeof data.data?.progress === 'number' ? Math.floor(data.data.progress / 5) * 5 : '';
      return `${event}:${id}:${status}:${progress}`;
    }

    return `${event}`;
  }

  /**
   * Periodically clears expired signatures from the cache.
   */
  private pruneOldFingerprints(now: number): void {
    if (this.recentFingerprints.size > 100) {
      for (const [key, timestamp] of this.recentFingerprints.entries()) {
        if (now - timestamp > DEDUPE_WINDOW_MS * 2) {
          this.recentFingerprints.delete(key);
        }
      }
    }
  }

  /**
   * Clears all listeners and fingerprint cache.
   */
  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
    this.recentFingerprints.clear();
  }
}

export const customerEventBus = new CustomerEventEmitter();
