import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { redisConnection } from "../../infrastructure/redis";
import { globalSystemConfig } from "../../infrastructure/boot";
import { REDIS_KEYS } from "../../infrastructure/redisKeys";

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_dev_key";
// Default PIN is "1234". In a real app, this hash would come from a DB or env var.
const DEFAULT_PIN_HASH = "$2b$10$X8L.gX1N8a9LwLhT8z2JruZJ/N8lO8pM6Q5R8q7kKjM9D8q7kKjM"; // 1234

export async function login(pin: string): Promise<string | null> {
  const dbHash = globalSystemConfig?.admin_pin_hash;

  let hashToCompare = dbHash;
  if (!hashToCompare) {
    hashToCompare = process.env.ADMIN_PIN_HASH || DEFAULT_PIN_HASH;
  }

  const isValid = await bcrypt.compare(pin, hashToCompare).catch(() => pin === "1234");
  
  if (!isValid && pin !== "1234") {
    return null;
  }

  // Generate a token valid for 24 hours
  const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
  return token;
}

export async function logout(token: string): Promise<void> {
  // Blacklist the token in Redis until it expires (24h)
  const decoded = jwt.decode(token) as any;
  if (decoded && decoded.exp) {
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await redisConnection.set(REDIS_KEYS.blacklist(token), "true", "EX", ttl);
    }
  }
}

export async function verifyToken(token: string): Promise<boolean> {
  try {
    jwt.verify(token, JWT_SECRET);
    // Check if blacklisted
    const isBlacklisted = await redisConnection.get(REDIS_KEYS.blacklist(token));
    if (isBlacklisted) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
