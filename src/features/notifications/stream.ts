import { API_BASE_URL } from "@/lib/api/auth";

/**
 * Live notifications over server-sent events (GET /notifications/stream).
 *
 * Keeps one connection open. `onNotification` runs each time the server pushes a new
 * notification; `onConnected` runs on every (re)connect so anything missed while
 * disconnected is picked up. The server closes the stream after about 10 minutes and
 * we reconnect with backoff (1 s, doubling, capped at 30 s).
 *
 * Uses fetch rather than EventSource because EventSource cannot send the Authorization header.
 * Returns a function that stops the stream.
 */
export function subscribeNotificationStream(
  token: string,
  onNotification: () => void,
  onConnected?: () => void,
): () => void {
  let stopped = false;
  let controller: AbortController | null = null;
  let retryTimer: number | undefined;
  let delay = 1000;

  async function connect() {
    if (stopped) return;
    controller = new AbortController();
    try {
      const res = await fetch(`${API_BASE_URL}/notifications/stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "text/event-stream" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`notification stream ${res.status}`);
      delay = 1000;
      onConnected?.();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let end = buffer.indexOf("\n\n");
        while (end !== -1) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          if (block.split("\n").includes("event: notification")) onNotification();
          end = buffer.indexOf("\n\n");
        }
      }
    } catch {
      // Network error, abort or non-OK response: fall through and reconnect.
    }
    if (stopped) return;
    retryTimer = window.setTimeout(() => { void connect(); }, delay);
    delay = Math.min(delay * 2, 30_000);
  }

  void connect();
  return () => {
    stopped = true;
    controller?.abort();
    if (retryTimer !== undefined) window.clearTimeout(retryTimer);
  };
}
