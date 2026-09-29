// server/src/app/services/realtimeGateway.service.ts
import { WebSocketServer, WebSocket } from "ws";
import { eventBus } from "../utils/eventBus";

export interface ManagedWebSocket extends WebSocket {
  isAlive?: boolean;
  role?: "customer" | "admin" | "kiosk" | "legacy" | string;
  sessionId?: string;
  rooms?: Set<string>;
}

// In-memory room manager
const rooms: Map<string, Set<ManagedWebSocket>> = new Map();
let wssInstance: WebSocketServer | null = null;

export function joinRoom(ws: ManagedWebSocket, roomName: string): void {
  if (!rooms.has(roomName)) {
    rooms.set(roomName, new Set());
  }
  rooms.get(roomName)!.add(ws);

  if (!ws.rooms) {
    ws.rooms = new Set();
  }
  ws.rooms.add(roomName);
}

export function leaveAllRooms(ws: ManagedWebSocket): void {
  if (ws.rooms) {
    for (const roomName of ws.rooms) {
      const set = rooms.get(roomName);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          rooms.delete(roomName);
        }
      }
    }
    ws.rooms.clear();
  }
}

export function broadcastToRoom(roomName: string, eventName: string, data: any): void {
  const set = rooms.get(roomName);
  if (!set || set.size === 0) return;
  const payload = JSON.stringify({ event: eventName, data });
  for (const client of set) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function broadcastToAll(eventName: string, data: any): void {
  if (!wssInstance) return;
  const payload = JSON.stringify({ event: eventName, data });
  for (const client of wssInstance.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function getActiveRoomCount(roomName: string): number {
  return rooms.get(roomName)?.size || 0;
}

/**
 * Initializes the unified multi-room WebSocket gateway on the HTTP server instance.
 */
export function initRealtimeGateway(server: any): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  server.on("upgrade", (request: any, socket: any, head: any) => {
    const pathname = request.url ? request.url.split("?")[0] : "";
    if (pathname === "/events" || pathname === "/api/events") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  // Global event routing from EventBus into appropriate WebSocket rooms
  eventBus.on("*", ({ event, data }: { event: string; data: any }) => {
    // 1. Customer Domain: "customer:job:*"
    if (event.startsWith("customer:")) {
      const targetSessionId = data?.sessionId || data?.data?.sessionId;
      if (targetSessionId) {
        broadcastToRoom(`room:customer:${targetSessionId}`, event, data);
      }
      // Also broadcast to Admin room so the Live Queue on Admin Dashboard updates instantly
      broadcastToRoom("room:admin", event, data);
      // Legacy room support during transition
      broadcastToRoom("room:legacy", event, data);
      return;
    }

    // 2. Admin Domain: "admin:*"
    if (event.startsWith("admin:")) {
      broadcastToRoom("room:admin", event, data);
      broadcastToRoom("room:legacy", event, data);
      if (event === "admin:fleet:state" || event === "admin:printer:state_changed") {
        broadcastToRoom("room:kiosk", event, data);
      }
      return;
    }

    // 3. Kiosk Domain: "kiosk:*"
    if (event.startsWith("kiosk:")) {
      broadcastToRoom("room:kiosk", event, data);
      // Internal kiosk hardware/network telemetry is scoped strictly to room:kiosk
      if (!event.startsWith("kiosk:network:")) {
        broadcastToRoom("room:admin", event, data);
      }
      return;
    }

    // 4. System Domain: "system:*"
    if (event.startsWith("system:")) {
      // System events (e.g. queue paused/resumed, broadcast alert) go to ALL customers AND admin
      broadcastToRoom("room:common", event, data);
      broadcastToRoom("room:admin", event, data);
      broadcastToRoom("room:kiosk", event, data);
      broadcastToRoom("room:legacy", event, data);
      return;
    }

    // 5. Legacy Events (job_queued, printer_state_changed, etc.)
    broadcastToRoom("room:legacy", event, data);
    broadcastToRoom("room:admin", event, data);
  });

  // Client connection lifecycle
  wss.on("connection", (ws: ManagedWebSocket, request: any) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Parse role and sessionId from query parameters
    try {
      const reqUrl = request.url || "";
      const queryIndex = reqUrl.indexOf("?");
      const queryParams = new URLSearchParams(queryIndex !== -1 ? reqUrl.substring(queryIndex) : "");
      
      const role = queryParams.get("role") || "legacy";
      const sessionId = queryParams.get("sessionId") || "";

      ws.role = role;
      ws.sessionId = sessionId;

      if (role === "customer") {
        if (sessionId) {
          joinRoom(ws, `room:customer:${sessionId}`);
        }
        joinRoom(ws, "room:common");
      } else if (role === "admin") {
        joinRoom(ws, "room:admin");
      } else if (role === "kiosk") {
        joinRoom(ws, "room:kiosk");
      } else {
        // Legacy or unspecified client: join common and legacy room for full backwards compatibility
        joinRoom(ws, "room:common");
        joinRoom(ws, "room:legacy");
      }
    } catch (parseErr) {
      console.warn("[RealtimeGateway] Error parsing connection URL params:", parseErr);
      joinRoom(ws, "room:common");
      joinRoom(ws, "room:legacy");
    }

    // Send connection greeting
    ws.send(JSON.stringify({
      event: "connected",
      data: {
        role: ws.role,
        sessionId: ws.sessionId || null,
        timestamp: new Date().toISOString()
      }
    }));

    // Client message handling (bi-directional capability)
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.action === "subscribe_session" && msg.sessionId) {
          ws.sessionId = msg.sessionId;
          joinRoom(ws, `room:customer:${msg.sessionId}`);
        }
      } catch {}
    });

    ws.on("close", () => {
      leaveAllRooms(ws);
    });

    ws.on("error", () => {
      leaveAllRooms(ws);
    });
  });

  // Ping/Pong connection health check every 30 seconds
  const pingInterval = setInterval(() => {
    wss.clients.forEach((client: any) => {
      if (client.isAlive === false) {
        leaveAllRooms(client);
        return client.terminate();
      }
      client.isAlive = false;
      client.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(pingInterval);
  });

  return wss;
}

// Alias for backwards compatibility
export const initWebSocketServer = initRealtimeGateway;
