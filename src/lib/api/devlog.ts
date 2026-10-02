const LOG_ENABLED = process.env.NODE_ENV !== "production";

/** Prints to the browser console and, via /api/dev-log, to the `next dev` terminal. */
export function trace(level: "log" | "error", label: string, data?: unknown) {
  if (!LOG_ENABLED) return;
  console[level](label, data);
  const payload = data instanceof Error ? { ...data, name: data.name, message: data.message } : data;
  void fetch("/api/dev-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ label, data: payload }),
    keepalive: true,
  }).catch(() => {});
}
