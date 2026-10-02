# Database Connection Resilience

Feature name: **Database Connection Resilience**

Fixes the intermittent "unable to sign in" failures where a login attempt errored, then the same credentials succeeded seconds later on retry. The same fault also broke contact loading.

## Symptom

Login failed unpredictably. Retrying two or three times worked, with no change to the credentials.

The dev server log (`.next/dev/logs/next-development.log`) showed the pattern plainly:

```text
04:36:33  [AUTHENTICATION] Attempting to authenticate...
04:36:33  Error: read ECONNRESET
04:36:56  [AUTHENTICATION] Attempting to authenticate...
04:36:57  Authentication successful
```

The stack trace pointed at the database call, not the auth logic:

```text
Error: read ECONNRESET
    at queryOne (src/lib/db.ts)
    at authenticateCredentials (src/lib/auth/service.ts)
    at POST (src/app/api/auth/login/route.ts)
```

## Root cause

A stale pooled socket. The connection pool handed out a TCP connection it believed was open, but which had already been closed at the network level. The first query on that dead socket fails with `read ECONNRESET`; the next attempt opens a fresh socket and succeeds.

What ruled out the obvious suspects:

| Check | Value | Conclusion |
| --- | --- | --- |
| `wait_timeout` | 28800 (8 hours) | MySQL is not closing these connections |
| `interactive_timeout` | 28800 (8 hours) | Same |
| `max_connections` | 500, with 8 threads connected | Not connection exhaustion |
| Credentials | Identical on the failing and succeeding attempt | Not an auth logic fault |

Since MySQL keeps idle connections for 8 hours but the socket was dead anyway, something between the app and the database is dropping the flow. `DB_HOST` is a raw public IP with `DB_SSL=false`, so traffic crosses the open internet through at least one NAT or firewall, and those devices commonly evict idle TCP flows after a few minutes.

The timing in the log matches that reading exactly: the server sat idle for roughly three hours, and the very first request after the gap failed instantly.

One counter-reading worth recording: the server reports `Aborted_connects` at about 99 percent of all connections. That looks alarming but is not this app's failure rate. It is a server-wide cumulative counter on a publicly exposed MySQL port, so internet background scanning inflates it heavily.

## Backend changes

All changes are in `src/lib/db.ts`. No other file needed to change.

### Pool tuning

The pool now retires idle connections before a middlebox can kill them, rather than holding sockets indefinitely and discovering they are dead at query time.

| Option | Value | Purpose |
| --- | --- | --- |
| `keepAliveInitialDelay` | 10s | Starts TCP keepalive probes early, so idle flows stay live in NAT tables |
| `idleTimeout` | 60s | Closes idle pooled connections well before a firewall drops them |
| `maxIdle` | 2 | Keeps few idle sockets around, shrinking the window for a stale one |
| `connectTimeout` | 15s | Fails a hung connect attempt instead of hanging the request |

`enableKeepAlive: true`, `connectionLimit: 10`, and `waitForConnections: true` were already set and are unchanged.

### Retry on connection-fatal errors

A new exported `execute()` helper retries a query once when it fails with an error code that indicates a broken connection rather than a bad query. The retry goes through the pool again, which yields a fresh socket.

```ts
const RETRYABLE = new Set([
  "ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED",
  "PROTOCOL_CONNECTION_LOST", "EHOSTUNREACH", "ENETUNREACH",
]);

export async function execute<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  values: ExecuteValues[] = [],
): Promise<T>;
```

Only these codes retry. A genuine SQL error, a constraint violation, or a syntax fault still throws immediately, so this never masks a real bug or silently repeats a failed write.

`queryOne` and `queryMany` were rewritten to call `execute()`. Because login uses `queryOne`, the sign-in path is now covered end to end.

## Frontend changes

None. This was a server-side connection fault, so no client code needed to change. The frontend already surfaced the failure correctly through the existing error banner. What changes for the user is that the failure stops occurring, and no retry-by-hand is needed.

## Verification

| Check | Result |
| --- | --- |
| `tsc --noEmit` | Clean |
| `eslint src/lib/db.ts` | Clean |
| Three consecutive login probes with bad credentials | `401 INVALID_CREDENTIALS` each time, no `500` |

A clean `401` is the meaningful signal here: it proves the user lookup query reached the database and returned, rather than dying on a reset socket.

## Follow-ups

- **Restart the dev server for pool options to apply.** The pool is cached on `globalThis`, so a hot reload reuses the pool built with the old settings. The retry helper does take effect on reload; the pool tuning does not.
- **Routes that bypass the retry.** The contacts, staff, and sales routes still call `getDatabase().execute(...)` directly, so they can still throw `ECONNRESET` — this is why `List contacts failed Error: read ECONNRESET` also appears in the log. Migrating them to the exported `execute()` would close that gap.
- **Consider TLS or a tunnel.** `DB_SSL=false` against a public-IP MySQL means credentials and data cross the internet unencrypted, and the unprotected path is what makes the connection unstable in the first place. Enabling TLS or moving the connection into a tunnel would improve both security and reliability, and would address the cause rather than the symptom.
