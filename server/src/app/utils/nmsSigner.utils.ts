import crypto from "crypto";

export interface SignedRequestOptions {
  baseUrl: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: any;
  deviceId: string;
  deviceSecret: string;
  timeoutMs?: number;
}

export interface NmsResponse<T = any> {
  status: number;
  ok: boolean;
  data: T;
}

/**
 * Computes SHA-256 hex hash of a string payload.
 */
export function hashBody(rawBodyText: string): string {
  return crypto.createHash("sha256").update(rawBodyText).digest("hex");
}

/**
 * Generates an HMAC-SHA256 signature matching the Central NMS auth middleware:
 * Canonical String: `${timestamp}:${method}:${path}:${bodyHash}`
 */
export function generateHmacSignature(
  secret: string,
  timestamp: number,
  method: string,
  path: string,
  rawBodyText: string = ""
): string {
  const bodyHash = hashBody(rawBodyText);
  const canonicalMessage = `${timestamp}:${method.toUpperCase()}:${path}:${bodyHash}`;
  return crypto.createHmac("sha256", secret).update(canonicalMessage).digest("hex");
}

/**
 * Sends an authenticated, signed HTTP request to the Central NMS with anti-replay protection.
 */
export async function sendSignedNmsRequest<T = any>(
  options: SignedRequestOptions
): Promise<NmsResponse<T>> {
  const method = (options.method || "POST").toUpperCase();
  const rawBodyText = options.body !== undefined ? JSON.stringify(options.body) : "";
  const timestamp = Date.now();

  const signature = generateHmacSignature(
    options.deviceSecret,
    timestamp,
    method,
    options.path,
    rawBodyText
  );

  const url = `${options.baseUrl.replace(/\/+$/, "")}${options.path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-device-id": options.deviceId,
      "x-device-timestamp": timestamp.toString(),
      "x-device-signature": signature
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: controller.signal
    };

    if (method !== "GET" && method !== "HEAD") {
      fetchOptions.body = rawBodyText;
    }

    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    let data: any = null;
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawText: text };
      }
    }

    return {
      status: response.status,
      ok: response.ok,
      data
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(`[NMS Client] Request to ${options.path} timed out after ${options.timeoutMs || 10000}ms`);
    }
    throw err;
  }
}
