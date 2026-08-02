import Redis from "ioredis";

// Ensure Redis is running and configured for AOF persistence
const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  maxRetriesPerRequest: null,
};

export const redisConnection = new Redis(redisConfig);
export const redisPublisher = new Redis(redisConfig);
export const redisSubscriber = new Redis(redisConfig);

redisConnection.on("error", (err) => {
  console.error("[Redis Error]", err);
});

redisConnection.on("ready", () => {
  console.log("🟢 Redis Connected");
});
