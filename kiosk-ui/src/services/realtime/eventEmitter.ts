// src/services/realtime/eventEmitter.ts
import type { KioskDomainEventMap, KioskEventName } from '../../types/events.types';

type Listener<T> = (payload: T) => void;
type AnyListener = (event: string, payload: any) => void;

export class KioskEventEmitter {
  private listeners = new Map<KioskEventName, Set<Listener<any>>>();
  private anyListeners = new Set<AnyListener>();

  // Layer 1 Deduplication: Sliding 1500ms fingerprint cache
  private seenFingerprints = new Map<string, number>();
  private readonly DEDUP_WINDOW_MS = 1500;

  private computeFingerprint(event: string, payload: any): string {
    const status = payload?.status || payload?.step || payload?.phase || '';
    const code = payload?.code || payload?.error || '';
    return `${event}:${status}:${code}`;
  }

  private isDuplicate(fingerprint: string): boolean {
    const now = Date.now();
    const lastSeen = this.seenFingerprints.get(fingerprint);
    if (lastSeen && (now - lastSeen) < this.DEDUP_WINDOW_MS) {
      return true;
    }
    this.seenFingerprints.set(fingerprint, now);

    // Purge old entries
    if (this.seenFingerprints.size > 200) {
      for (const [key, ts] of this.seenFingerprints.entries()) {
        if (now - ts > this.DEDUP_WINDOW_MS * 2) {
          this.seenFingerprints.delete(key);
        }
      }
    }
    return false;
  }

  public on<E extends KioskEventName>(event: E, listener: Listener<KioskDomainEventMap[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.off(event, listener);
    };
  }

  public off<E extends KioskEventName>(event: E, listener: Listener<KioskDomainEventMap[E]>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public onAny(listener: AnyListener): () => void {
    this.anyListeners.add(listener);
    return () => {
      this.anyListeners.delete(listener);
    };
  }

  public emit<E extends KioskEventName>(event: E, payload: KioskDomainEventMap[E], skipDedup = false): boolean {
    if (!skipDedup) {
      const fingerprint = this.computeFingerprint(event, payload);
      if (this.isDuplicate(fingerprint)) {
        console.debug(`[KioskEventEmitter] Suppressed rapid duplicate event: ${fingerprint}`);
        return false;
      }
    }

    const set = this.listeners.get(event);
    if (set) {
      set.forEach((listener) => {
        try {
          listener(payload);
        } catch (err) {
          console.error(`[KioskEventEmitter] Error in listener for event ${event}:`, err);
        }
      });
    }

    this.anyListeners.forEach((listener) => {
      try {
        listener(event, payload);
      } catch (err) {
        console.error(`[KioskEventEmitter] Error in wildcard listener for ${event}:`, err);
      }
    });

    return true;
  }

  public removeAllListeners(event?: KioskEventName): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
      this.anyListeners.clear();
    }
  }
}

export const kioskEventBus = new KioskEventEmitter();
