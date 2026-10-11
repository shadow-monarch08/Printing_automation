import net from "net";

/**
 * Parses the hostname and port from standard network printer URIs:
 * socket://<host>[:<port>] (default port 9100)
 * lpd://<host>[:<port>] (default port 515)
 * ipp://<host>[:<port>] / ipps://<host>[:<port>] (default port 631)
 */
export function extractHostAndPort(
  uri: string,
  defaultPort = 9100
): { host: string; port: number } | null {
  try {
    const match = uri.match(/^(?:socket|lpd|ipp|ipps):\/\/([^/:]+)(?::(\d+))?/i);
    if (!match) return null;

    const host = match[1];
    let port = defaultPort;

    if (match[2]) {
      port = parseInt(match[2], 10);
    } else {
      const lowerUri = uri.toLowerCase();
      if (lowerUri.startsWith("socket://")) port = 9100;
      else if (lowerUri.startsWith("lpd://")) port = 515;
      else if (lowerUri.startsWith("ipp://") || lowerUri.startsWith("ipps://")) port = 631;
    }

    return { host, port };
  } catch {
    return null;
  }
}

/**
 * Fast, non-blocking TCP socket ping to verify physical hardware and daemon availability.
 * Avoids false negatives from blocked/disabled SNMP agents.
 */
export function pingTcpPort(
  host: string,
  port = 9100,
  timeoutMs = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isResolved = false;

    const cleanupAndResolve = (result: boolean) => {
      if (!isResolved) {
        isResolved = true;
        socket.destroy();
        resolve(result);
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      cleanupAndResolve(true);
    });

    socket.on("timeout", () => {
      cleanupAndResolve(false);
    });

    socket.on("error", () => {
      cleanupAndResolve(false);
    });

    try {
      socket.connect(port, host);
    } catch {
      cleanupAndResolve(false);
    }
  });
}
