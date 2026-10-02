---
name: ui-states
description: Make sure every new UI feature that loads, submits or shows remote data handles its essential states - loading, empty, network/offline, server error, and success - without piling on extras. Use this whenever the user asks to build, add or change a page, list, form, dashboard, modal or any component that calls an API, and also when they mention loading state, empty state, error state, offline, network error, retry, skeleton or spinner, even if they don't say "states".
---

# UI states for new features

Users judge a feature by what happens when things go wrong: a blank screen, a spinner that never ends, or "Something went wrong" with no way out all feel broken. The goal is that every state the feature can actually reach is handled, and no state it can't reach gets built. Each extra state is more UI to design, test and keep consistent, so completeness and restraint matter equally.

## 1. List the states this feature can reach

Before coding, write a short table in your head (or in the change notes): for each state below, ask "can a user reach this here?" Build it only if yes.

| State | Reachable when | Minimum treatment |
| --- | --- | --- |
| **Loading** | Data is fetched or a request is submitted | Initial load: a spinner or a few skeleton rows in the space the content will fill. Submit: disable the button and change its label ("Saving..."). |
| **Empty** | A list/query can return zero items | Say what is missing and, if the user can fix it, offer the action ("No leads yet - Add lead"). Distinguish *nothing exists* from *no results for this filter* (offer "Clear filters"). |
| **Server error** | Any request can return 5xx or an unexpected response | Plain-language message, a "Try again" button, keep the rest of the page usable. |
| **Network / offline** | Request fails to send, times out, or the browser is offline | Say it is a connection problem (not the app's fault), retry button. If the browser is offline, disable actions that cannot work and show a small notice. |
| **Success / populated** | Always | The normal view. After a mutation, confirm briefly (inline text or a toast, not both). |

Add these only when the feature genuinely has them:

- **Validation error** - forms: message next to the field or at the top of the form, keep what the user typed.
- **Unauthorized / forbidden** - features behind login or roles: 401 sends the user to sign in ("Your session has expired"); 403 says they lack access. Do not show these as generic errors.
- **Not found** - detail pages opened by id.
- **Stale / refetch failed** - data already on screen and a background refresh fails: keep the old data, show a small "couldn't refresh" note. Do not blank the screen.

## 2. Keep it simple

- Model the request as one status value (`idle | loading | success | error`) plus the data and a typed error, instead of several booleans that can contradict each other.
- Collapse errors into a handful of kinds (offline, network, timeout, unauthorized, forbidden, validation, server, unknown), each with one message. Do not build a screen per HTTP status.
- Offer "Try again" only for errors where retrying can help (offline, network, timeout, 5xx). For wrong credentials or validation, retrying the same input is pointless.
- One loading style per screen. Skip skeletons for short, small content; a spinner or disabled button is enough.
- Reuse the project's existing message, banner and button styles before adding new ones.
- Don't add states for things that cannot happen (an empty state for a list that always has a default row, offline handling for a purely local component).

## 3. Implementation rules that prevent common bugs

- **Offline check**: read `navigator.onLine` before sending, and also treat a rejected `fetch` as a network error, since `onLine` can be wrong. Listen to `online`/`offline` events (`useSyncExternalStore`) so the UI recovers on its own.
- **Timeout**: use `AbortController` (about 15 s) so a hung request ends in an error state instead of loading forever.
- **Error parsing**: read the backend's real error shape (for FastAPI: `detail` as a string or a list of `msg`) and fall back to a generic message when the body is not JSON.
- **No double submits**: ignore or disable submission while a request is in flight.
- **Don't clear good data** when a refetch fails.
- **Clear stale errors** when the user edits the input or retries.
- **Accessibility**: `role="alert"` for errors, `role="status"` for offline/info notices, `aria-busy` on the busy control.
- **Reset on navigation**: don't let a previous screen's error flash on the next one.

In this repo, `src/lib/api/auth.ts` (typed `ApiError` kinds, timeout, offline check), `src/hooks/useLogin.ts` (status state) and `src/hooks/useOnlineStatus.ts` are a working reference; reuse or generalize them instead of rewriting.

## 4. Verify

Exercise each state you built: throttle or block the network, stop the backend, return a 500, return an empty array. For logic that maps responses to states, add a small unit test (see `tests/api/auth-client.test.ts`).

## 5. Report

End with two short lists: the states you implemented, and the states you deliberately skipped with a one-line reason each. That makes it easy for the user to ask for one back if they disagree.
