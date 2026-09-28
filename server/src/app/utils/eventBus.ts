// server/src/app/utils/eventBus.ts
import { EventEmitter } from "events";
import crypto from "crypto";
import { redisPublisher, redisSubscriber } from "../../infrastructure/redis";
import type { EventMap, EventName } from "../types/events.types";

const PROCESS_ID = crypto.randomUUID();

// Mapping for backward compatibility between legacy and modernized event names
const LEGACY_FORWARD_MAP: Record<string, string> = {
  "job_queued": "customer:job:queued",
  "job_active": "customer:job:active",
  "job_completed": "customer:job:completed",
  "job_failed": "customer:job:failed",
  "printer_state_changed": "admin:fleet:state",
  "printer_quarantined": "admin:printer:quarantined",
  "queue_paused": "system:queue:paused",
  "queue_resumed": "system:queue:resumed",
  "system_critical": "admin:metrics:critical",
};

const LEGACY_REVERSE_MAP: Record<string, string> = {
  "customer:job:queued": "job_queued",
  "customer:job:active": "job_active",
  "customer:job:completed": "job_completed",
  "customer:job:failed": "job_failed",
  "admin:fleet:state": "printer_state_changed",
  "admin:printer:quarantined": "printer_quarantined",
  "system:queue:paused": "queue_paused",
  "system:queue:resumed": "queue_resumed",
  "admin:metrics:critical": "system_critical",
};

export class EventBus extends EventEmitter {
  private channel = "events:bus";

  constructor() {
    super();
    // Allow high number of listeners for active event multiplexing
    this.setMaxListeners(100);

    redisSubscriber.subscribe(this.channel, (err) => {
      if (err) {
        console.error("[EventBus] Failed to subscribe to Redis channel:", err);
      } else {
        console.log(`[EventBus] Subscribed to Redis channel '${this.channel}'`);
      }
    });

    redisSubscriber.on("message", (channel, message) => {
      if (channel === this.channel) {
        try {
          const { eventName, data, originId } = JSON.parse(message);
          // Prevent double local dispatch if originated from this process
          if (originId !== PROCESS_ID) {
            this.dispatchLocal(eventName, data);
          }
        } catch (e) {
          console.error("[EventBus] Error parsing Redis message:", e);
        }
      }
    });
  }

  /**
   * Internal local dispatcher that dispatches to exact event names,
   * wildcard patterns, and legacy compatibility aliases.
   */
  private dispatchLocal(eventName: string, data: any): void {
    // 1. Direct exact event emission
    super.emit(eventName, data);

    // 2. Wildcard pattern emissions (e.g. "customer:*" or "*")
    if (eventName.includes(":")) {
      const parts = eventName.split(":");
      const prefix = parts[0]; // e.g. "customer"
      super.emit(`${prefix}:*`, { event: eventName, data });

      if (parts.length > 2) {
        super.emit(`${parts[0]}:${parts[1]}:*`, { event: eventName, data });
      }
    }
    super.emit("*", { event: eventName, data });

    // 3. Bidirectional legacy alias dispatch
    const modernEquivalent = LEGACY_FORWARD_MAP[eventName];
    if (modernEquivalent) {
      super.emit(modernEquivalent, data);
    }
    const legacyEquivalent = LEGACY_REVERSE_MAP[eventName];
    if (legacyEquivalent) {
      super.emit(legacyEquivalent, data);
    }
  }

  /**
   * Emits a type-safe or generic domain event locally and across Redis Pub/Sub.
   */
  emit<K extends EventName>(eventName: K, data: EventMap[K]): boolean;
  emit(eventName: string, data?: any): boolean;
  emit(eventName: string, data?: any): boolean {
    const payload = JSON.stringify({
      eventName: String(eventName),
      data,
      originId: PROCESS_ID,
      timestamp: Date.now(),
    });

    redisPublisher.publish(this.channel, payload).catch((err) => {
      console.error("[EventBus] Failed to publish event to Redis:", err);
    });

    this.dispatchLocal(String(eventName), data);
    return true;
  }
}

export const eventBus = new EventBus();
