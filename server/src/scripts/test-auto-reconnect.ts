import { autoReconnectKnownWifi } from "../app/services/wifi.service";

async function test() {
  console.log("=== Testing autoReconnectKnownWifi() with visible beacon intersection ===");
  const start = Date.now();
  const result = await autoReconnectKnownWifi();
  const elapsed = Date.now() - start;
  console.log(`Result: "${result}", Completed in ${elapsed}ms`);
}

test().catch(console.error);
