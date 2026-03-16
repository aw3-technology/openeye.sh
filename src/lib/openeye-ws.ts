const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 30000;

type Listener = (data: unknown) => void;
type StatusListener = (status: { connected: boolean; error?: string }) => void;

export class OpenEyeWebSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private maxAttempts = MAX_RECONNECT_ATTEMPTS;
  private _url: string;
  private _path: string;
  private _shouldConnect = false;
  private sendBuffer: string[] = [];

  constructor(url: string, path: string = "/ws") {
    this._url = url;
    this._path = path;
  }

  get url() {
    return this._url;
  }

  set url(newUrl: string) {
    this._url = newUrl;
    if (this._shouldConnect) {
      this.disconnect();
      this.connect();
    }
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect() {
    this._shouldConnect = true;
    this.attempt = 0;
    this._connect();
  }

  private _connect() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.stopPing();

    if (!this._url) {
      this.emitStatus({ connected: false, error: "No server URL configured" });
      return;
    }

    let parsed: URL;
    try {
      parsed = new URL(this._url);
    } catch {
      this.emitStatus({ connected: false, error: `Invalid server URL: ${this._url}` });
      return;
    }
    parsed.protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = parsed.origin + this._path;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.attempt = 0;
      this.emitStatus({ connected: true });
      this.flushBuffer();
      this.startPing();
    };

    this.ws.onmessage = (ev) => {
      // Handle pong responses for heartbeat
      if (ev.data === "pong") {
        if (this.pongTimeout) {
          clearTimeout(this.pongTimeout);
          this.pongTimeout = null;
        }
        return;
      }

      if (typeof ev.data !== "string") {
        // Binary frame — forward raw data to listeners
        this.listeners.forEach((fn) => fn(ev.data));
        return;
      }

      try {
        const data = JSON.parse(ev.data);
        this.listeners.forEach((fn) => fn(data));
      } catch (err) {
        console.warn("[OpenEyeWS] Failed to parse message:", err);
        // Non-JSON text frame — forward as-is
        this.listeners.forEach((fn) => fn(ev.data));
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.emitStatus({ connected: false });
      if (!this._shouldConnect) return;
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private startPing() {
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
        this.pongTimeout = setTimeout(() => {
          // No pong received — connection is half-open, force reconnect
          this.ws?.close();
        }, 5000);
      }
    }, 30000);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private scheduleReconnect() {
    if (this.attempt >= this.maxAttempts) {
      this.emitStatus({
        connected: false,
        error: `Failed to reconnect after ${this.maxAttempts} attempts`,
      });
      return;
    }
    const delay = Math.min(1000 * 2 ** this.attempt, MAX_BACKOFF_MS);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  private emitStatus(status: { connected: boolean; error?: string }) {
    this.statusListeners.forEach((fn) => fn(status));
  }

  private flushBuffer() {
    while (this.sendBuffer.length > 0 && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(this.sendBuffer.shift()!);
    }
  }

  disconnect() {
    this._shouldConnect = false;
    this.stopPing();
    this.sendBuffer = [];
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else if (this._shouldConnect) {
      this.sendBuffer.push(data);
    }
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  onStatus(fn: StatusListener) {
    this.statusListeners.add(fn);
    return () => {
      this.statusListeners.delete(fn);
    };
  }
}
