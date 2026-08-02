import { EventEmitter } from "events";
import { redisPublisher, redisSubscriber } from "../../infrastructure/redis";

class EventBus extends EventEmitter {
  private channel = "events:bus";

  constructor() {
    super();
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
          const { eventName, data } = JSON.parse(message);
          super.emit(eventName, data);
        } catch (e) {
          console.error("[EventBus] Error parsing Redis message:", e);
        }
      }
    });
  }

  emit(eventName: string | symbol, data?: any): boolean {
    const payload = JSON.stringify({ eventName: String(eventName), data });
    redisPublisher.publish(this.channel, payload).catch((err) => {
      console.error("[EventBus] Failed to publish event to Redis:", err);
    });
    return super.emit(eventName, data);
  }
}

export const eventBus = new EventBus();
