/**
 * Dev-only: prints client-side API traces in the `next dev` terminal.
 * Returns 404 in production so it can never be used to write to server logs.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });

  try {
    const { label, data } = (await request.json()) as { label?: unknown; data?: unknown };
    console.log(String(label ?? "[client]").slice(0, 200), data === undefined ? "" : JSON.stringify(data, null, 2)?.slice(0, 20_000));
  } catch {
    // Malformed payloads are ignored; this endpoint is best-effort.
  }
  return new Response(null, { status: 204 });
}
