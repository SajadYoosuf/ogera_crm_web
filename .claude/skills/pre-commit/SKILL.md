---
name: pre-commit
description: Gate every web commit — run Vitest, TypeScript check, ESLint, and a production build. Use this BEFORE every git commit for any feature, fix, component change, or multi-file refactor. Triggered by "commit", "push", "ready to commit", "pre-commit", "run tests", "is it working", "done", "build", or when about to call git commit. Do not skip for small changes — the gate catches what the browser hides.
---

# Pre-commit gate (web)

A commit is not ready when it looks right in the browser; it is ready when this gate passes. Run every step in order. Stop at the first P0 failure and fix it before continuing.

## Priority levels

**P0 — blocking:** The commit cannot go out until these pass.
**P1 — high:** Fix before committing unless a pre-existing failure is documented.
**P2 — advisory:** Note in the commit message or change notes; may ship.

---

## Step 1 — Unit and component tests (P0)

```bash
cd ogera_crm_web
npm test -- --run 2>&1
```

(`--run` exits after one pass; without it Vitest stays in watch mode.)

**Passage threshold:**
- All existing tests must pass (P0).
- Any new feature, hook, component, or API function you wrote must have at least one test (P1). If none exists, write it now using the `feature-testing` skill as a guide.
- If the suite reports `No test files found`, that is not a pass: add a smoke test.

**Pre-existing failures:** If a test was failing before your change (`git stash && npm test -- --run; git stash pop`), document it in `docs/changes/YYYY-MM-DD-<slug>.md` under **Known issues**. Do not comment out assertions to get green.

---

## Step 2 — TypeScript check (P0)

```bash
cd ogera_crm_web
npx tsc --noEmit 2>&1
```

Expected: no output, exit 0. Any type error is blocking. Fix the type, do not add `// @ts-ignore` or `any` casts without a comment explaining why.

---

## Step 3 — ESLint (P1)

```bash
cd ogera_crm_web
npm run lint 2>&1
```

Expected: no errors (warnings are advisory). Fix errors; warnings can ship with a note.
If you changed only files outside `src/`, you may skip this step — say so in the report.

---

## Step 4 — Production build (P0)

```bash
cd ogera_crm_web
npm run build 2>&1
```

This is the most important step. The dev server hides many real problems (missing imports, bad RSC boundaries, bad env refs). The build catches them all.

Expected: `✓ Compiled successfully` (or the Next.js equivalent). Any build error is P0.

Common build failures and their fixes:
- **"Module not found"**: the import path is wrong or the file was not staged.
- **"'X' is not a valid Server Component prop"**: a server component is receiving a non-serialisable value. Move the logic to a client component.
- **"Dynamic server usage"**: a server component reads `headers()` or `cookies()` outside a Suspense boundary. Wrap it.
- **"NEXT_PUBLIC_* used at runtime"**: the env var is read on the server; use it at build time or move to a client component.

Do not ship a commit that fails `npm run build`. Vercel will reject it.

---

## Step 5 — Conflict check (P0)

```bash
cd ogera_crm_web
git status
git diff --stat HEAD
```

Confirm:
- No merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) in any staged file. Run `grep -rn "<<<<<<" src/` to be sure.
- No unintended files in the diff (`.env.local`, `node_modules/`, `.next/`).
- `package-lock.json` or `package.json` is included if dependencies changed.

---

## Step 6 — Change note (P0 for major changes; P2 for small fixes)

Major changes (new feature, new page, new API endpoint call, design system change, role-access change) require a change note at `docs/changes/YYYY-MM-DD-<slug>.md` with:

- **What changed** — files and behaviour.
- **Access / data impact** — any auth, role or data effect.
- **Verification** — paste test summary (`N passed`) and build result (`✓ Compiled`), and list any step not run.
- **Known issues** — pre-existing failures, skipped tests, or items not done.

Small fixes (one-line, typo, style-only) need no note but the commit message must say what changed and why.

---

## Gate summary

| Step | Priority | Pass condition |
|------|----------|----------------|
| `npm test -- --run` | P0 | All tests pass; new features have tests |
| `npx tsc --noEmit` | P0 | No type errors |
| `npm run lint` | P1 | No lint errors (warnings advisory) |
| `npm run build` | P0 | Build succeeds with no errors |
| Conflict markers absent | P0 | `grep` finds nothing |
| Change note written | P0 (major) / P2 (fix) | File exists before commit |

**Do not call `git commit` until all P0 steps pass.**
When all P0 steps pass and ≥ 80% of P1 steps pass, the commit is ready.
Report the result in a single table (step, status, notes) before committing.
