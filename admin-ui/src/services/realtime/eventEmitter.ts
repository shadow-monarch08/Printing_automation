// admin-ui/src/services/realtime/eventEmitter.ts
import type { AdminEventMap, AdminEventType } from '../../types/events.types';

type Listener<T> = (data: T) => void;
type AnyListener = (event: string, data: any) => void;

const DEDUPE_WINDOW_MS = 1500;

export class AdminEventEmitter {
  private listeners = new Map<AdminEventType, Set<Listener<any>>>();
  private anyListeners = new Set<AnyListener>();

  // Layer 1: Sliding Window Fingerprint Cache for Deduplication
  private recentFingerprints = new Map<string, number>();

  /**
   * Registers a typed event listener. Returns an instant unsubscribe function.
   */
  on<K extends AdminEventType>(event: K, listener: Listener<AdminEventMap[K]>): () => void {
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
  off<K extends AdminEventType>(event: K, listener: Listener<AdminEventMap[K]>): void {
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
  emit<K extends AdminEventType>(event: K, data: AdminEventMap[K]): boolean {
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
          console.error(`[AdminEventEmitter] Error in listener for event "${event}":`, err);
        }
      });
    }

    // 2. Notify wildcard listeners
    if (this.anyListeners.size > 0) {
      this.anyListeners.forEach((handler) => {
        try {
          handler(event, data);
        } catch (err) {
          console.error(`[AdminEventEmitter] Error in wildcard listener for event "${event}":`, err);
        }
      });
    }

    return true;
  }

  /**
   * Computes a unique signature for the event payload.
   */
  private computeFingerprint(event: AdminEventType, data: any): string | null {
    // Handshake events are always allowed
    if (event === 'connected') return null;

    if (data && typeof data === 'object') {
      if (event.startsWith('customer:job:')) {
        const id = data.id || '';
        const status = data.status || data.data?.status || data.reason || '';
        return `${event}:${id}:${status}`;
      }
      if (event === 'admin:fleet:state') {
        return `${event}:${data.printer}:${data.state}`;
      }
      if (event === 'admin:printer:quarantined') {
        return `${event}:${data.printer}`;
      }
      if (event === 'admin:queue:sync') {
        return `${event}:${data.action}:${data.jobId || ''}`;
      }
      if (event === 'admin:metrics:critical') {
        return `${event}:${data.type}`;
      }
      if (event.startsWith('system:queue:')) {
        return `${event}`;
      }
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

export const adminEventBus = new AdminEventEmitter();
