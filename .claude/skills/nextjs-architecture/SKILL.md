# Next.js Architecture Skill — Ogera CRM Web

This skill captures the full architecture of the Ogera CRM Next.js frontend so future sessions can follow established patterns without re-deriving them.

---

## Stack

- **Framework**: Next.js App Router (`src/app/`)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, brand accent `#0E4D3A`
- **State**: React hooks + Context (no external state library)
- **Auth**: JWT stored in `sessionStorage` by `AuthContext`

---

## Folder Layout

```
src/
  app/              — Next.js App Router pages (route handlers + UI shells)
  components/       — Reusable UI components (may import from features/)
  context/          — React context providers
  features/         — Feature folders (the primary unit of organisation)
  hooks/            — Shared React hooks
  lib/
    api/            — Re-export shims pointing to features/*/api/
    shared/         — Pure utility functions (no React)
  types/            — Shared TypeScript types
```

---

## Feature Folder Pattern

Every feature lives under `src/features/<feature>/`:

```
src/features/<feature>/
  api/
    <feature>.ts      — Types + API functions (uses authed<T>() helper)
  hooks/
    use<Feature>List.ts  — All useState/useEffect/useCallback data logic
  components/
    <FeatureModal>.tsx   — Self-contained modal components
  utils.ts (optional)  — Feature-specific pure utilities
```

### Why this matters
- Pages (`src/app/`) are **pure UI** — they import a custom hook and render.
- API types live once in `features/*/api/`, not duplicated in pages.
- `src/lib/api/<resource>.ts` files are shims: `export * from "@/features/<feature>/api/<feature>"` so old imports keep resolving.

---

## AuthContext — single source of truth for the JWT

**Location**: `src/context/AuthContext.tsx`

```typescript
const { token, user, isLoading, setSession, clearSession } = useAuth();
```

| Field | Type | Purpose |
|-------|------|---------|
| `token` | `string \| null` | The JWT — pass to every API call |
| `user` | `SessionUser \| null` | `{ id, name, email, role, company }` |
| `isLoading` | `boolean` | True while checking session on mount |
| `setSession(token, user)` | fn | Called after login; writes sessionStorage |
| `clearSession()` | fn | Called on logout; clears sessionStorage |

### Rules

1. **Never** call `sessionStorage.getItem("ogera_access_token")` directly. Always use `useAuth().token`.
2. **Never** call `sessionStorage.getItem("ogera_user")` directly. Always use `useAuth().user`.
3. `token` from `useAuth()` goes into the dep array of any `useCallback` or `useEffect` that uses it.
4. Early-return pattern: `if (!token) { setError("Sign in again."); return; }` — no `?? ""` fallback for guarded actions.

---

## Shared Utilities (`src/lib/shared/`)

| File | Exports |
|------|---------|
| `pagination.ts` | `pageItems(page, total, pageSize)` — returns `{ start, end, hasPrev, hasNext }` |
| `csv.ts` | `toCsvCell(v)`, `downloadCsv(filename, headers, rows)` |
| `format.ts` | `formatDate(iso)`, `formatRupees(n)`, `todayIso()` |
| `avatar.ts` | `initials(name)`, `avatarTint(name)` — deterministic pastel colour |

Import from `@/lib/shared/<file>`, not by relative path.

---

## Custom Hook Pattern

Every feature with a list page has a `use<Feature>List.ts` hook:

```typescript
// src/features/products/hooks/useProductsList.ts
export function useProductsList() {
  const { token } = useAuth();      // ← always useAuth, never sessionStorage

  const [rows, setRows] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  // ... filters, pagination state

  const load = useCallback(async () => {
    if (!token) return;
    // fetch and setRows
  }, [token, ...otherDeps]);        // ← token in dep array

  useEffect(() => { void load(); }, [load]);

  return { rows, isLoading, error, /* controls */ };
}
```

The page then becomes:

```typescript
// src/app/dashboard/products/page.tsx
export default function ProductsPage() {
  const { rows, isLoading, error, page, setPage } = useProductsList();
  return <ProductsTable rows={rows} ... />;
}
```

---

## API Helper Pattern (`features/*/api/<feature>.ts`)

```typescript
import { request, ApiError } from "@/lib/api/auth";

// Maps HTTP errors to safe user-facing messages.
async function authed<T>(token: string, fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) throw new ApiError(401, "Your session expired. Sign in again.");
      if (err.status === 403) throw new ApiError(403, "You do not have permission to do this.");
    }
    throw err;
  }
}

export function listProducts(token: string, query: ProductQuery): Promise<ProductList> {
  return authed(token, () => request<ProductList>(`/products?${buildParams(query)}`, {
    headers: { Authorization: `Bearer ${token}` },
  }));
}
```

### Rules
- Never return raw `fetch` responses — always parse and type them.
- Never expose internal DB errors — the `authed` wrapper normalises 401/403.
- All API functions take `token: string` as the first argument.

---

## Multi-Tenant Guard

Every user carries `user.company.id` as their tenant identifier. The backend enforces row-level tenancy; the frontend only needs to:

1. Store `user` from `useAuth()` — it already contains `company.id`.
2. Check `user.role` for RBAC on UI visibility (`"admin"`, `"manager"`, `"staff"`).
3. Never pass a company ID manually in API calls — the JWT carries it.

---

## Component Modal Pattern

Self-contained modals live in `features/<feature>/components/` and receive:

```typescript
interface Props {
  productId: number | null;   // null = create mode
  onClose: () => void;
  onChanged: () => void;      // tells the parent to reload
}
```

They call `useAuth()` themselves for the token — they do **not** receive a token as a prop.

---

## Re-export Shims

When a file is moved into a feature folder, the original path becomes a one-line shim so existing imports keep working:

```typescript
// src/lib/api/products.ts (shim)
/** Moved to features/products/api/products.ts. */
export * from "@/features/products/api/products";

// src/components/products/ProductModal.tsx (shim)
/** Moved to features/products/components/ProductModal.tsx. */
export { default } from "@/features/products/components/ProductModal";
```

---

## Checklist for Adding a New Feature

1. Create `src/features/<feature>/api/<feature>.ts` with types + functions.
2. Create `src/features/<feature>/hooks/use<Feature>List.ts` — all state here.
3. Create `src/features/<feature>/components/` for modals/detail views.
4. Update `src/app/dashboard/<feature>/page.tsx` to pure UI that uses the hook.
5. Turn `src/lib/api/<feature>.ts` into a shim (if it existed).
6. Add shared utilities to `src/lib/shared/` if they would be reused.
7. Use `useAuth().token` everywhere — no `sessionStorage` direct reads.
8. Add `token` to every `useCallback` / `useEffect` dep array that uses it.
