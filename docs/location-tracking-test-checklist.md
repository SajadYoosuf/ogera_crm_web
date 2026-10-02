# Location tracking — test checklist

Covers the full pipeline: `LocationTrackingService` → `LocationQueue` →
`LocationApiService` → `POST/GET /api/staff/locations/*` → `staff_live_locations`
table → `StaffLiveMap.tsx` / mobile map. Written after fixing the "background
service gated on Always permission" bug (`location_tracking_service.dart:242-261`).

Legend: `[x]` covered by a test that has actually been run and passes,
`[ ]` still to do. File paths match the repo's existing test layout
(`ogera_crm_mobile/test/`, `tests/api/`, `tests/integration/`).

**Status: sections 1 and 2 are done. Section 3 is done except the DB-backed
backend test, deliberately left unwritten-and-unrun — see its note. Section 4
is manual by nature.**

---

## 0. An environment finding worth knowing before touching these tests

`flutter test`'s `testWidgets()` runs each test body inside a `FakeAsync` zone
(`AutomatedTestWidgetsFlutterBinding.runTest`). In this repo's current Flutter
build, **explicitly calling `.cancel()` on a `StreamController.broadcast()`
subscription from inside a `testWidgets` test body hangs the test framework's
own completion machinery for the full test timeout** — reproduced with a bare
`StreamController`, no plugin involved, regardless of whether a widget was
ever pumped or an event ever emitted. Plain `test()` (no widget tree) is
unaffected.

This matters here because `LocationTrackingService.start()` subscribes to two
broadcast streams (`Geolocator.getPositionStream()`, `Connectivity().onConnectivityChanged`),
and `stop()` explicitly cancels both. Letting a widget test reach a real
`start()`/`stop()` pair hangs for the full default 10-minute test timeout —
not a fast, obvious failure.

**Workaround used throughout**: `test/fakes/no_op_start_tracking_service.dart`
is a `LocationTrackingService` subclass whose `start()` does nothing. Widget
tests that need `SessionViewModel.permission`/`.status` to transition
correctly use it instead of the real service; the real `start()` is only ever
exercised in plain `test()` files, where this issue does not occur.
`location_tracking_service_test.dart` and `staff_location_session_flow_test.dart`
both use the real service safely for exactly this reason.

---

## 1. Unit tests

### `ogera_crm_mobile/test/location_tracking_service_test.dart` (done — 14 tests, run and passing)

Testable via `GeolocatorPlatform.instance = FakeGeolocatorPlatform()` (see
`test/fakes/`) — no production-code seam was needed; `geolocator`'s
platform-interface layer is designed to be swapped for tests.

- [x] `checkPermission` maps every `LocationPermission` value to the right
      `LocationPermissionState`, and reports `serviceDisabled` before looking
      at the grant at all.
- [x] `canTrack` is true only for `granted` and `grantedForeground`.
- [x] `needsSettings` is true only for `deniedForever` and `serviceDisabled`
      (asserts the current gap documented in
      `LOCATION_BACKGROUND_TRACKING_REPORT.md` §3.3 — flip the expectation,
      don't delete it, if that gap gets fixed).
- [x] `start()` does nothing when `checkPermission()` resolves to a state
      where `canTrack` is false.
- [x] **Regression test for the fix**: `start()` requests a foreground
      service (`background: true`, i.e. `AndroidSettings.foregroundNotificationConfig
      != null`) on Android for *both* `granted` and `grantedForeground`, not
      just `granted`. Verified this fails against the pre-fix code (reverted
      it locally, confirmed red, restored).
- [x] `start()` is a no-op when already tracking (doesn't re-request a stream).
- [x] The very first fix is recorded and flushed immediately, without waiting
      a full 60s heartbeat.
- [x] `flush()`: drains the queue in batches of 10, including a short final
      batch.
- [x] `flush()`: a failed upload leaves the batch queued (nothing dropped);
      a forced retry afterwards succeeds and drains it.
- [x] `flush()`: a non-forced call inside the 2-minute retry backoff is a
      no-op — this doubles as the **known-gap test**: it documents that the
      connectivity-restored listener also calls `flush()` unforced, so
      reconnecting mid-backoff still doesn't upload immediately. Flip this
      test if that ever gets fixed; don't delete it.
- [x] `stop()`: clears the queue by default, reports the given state, and
      leaves the queue alone when `clearQueue: false`.
- [ ] iOS path still gates `allowBackgroundLocationUpdates` on `granted` only
      (needs `debugDefaultTargetPlatformOverride = TargetPlatform.iOS` cases —
      lower priority: the Android path is what the fix in this round touched).
- [ ] `_updateMovement` distance/speed thresholds (20 m / 0.8 m/s) — assert
      indirectly through `PendingPoint.isMoving` in an uploaded batch, since
      `_isMoving` itself is private.
- [ ] `currentDebugTick` / `LocationDebugTick.toString()` exact formatting.

### `ogera_crm_mobile/test/location_queue_test.dart` (done — 9 tests, run and passing)

Runs against real `sqflite` via `sqflite_common_ffi` (added as a dev
dependency) rather than an in-memory fake, so the actual SQL is exercised.

- [x] A new queue starts empty.
- [x] `add()` persists a point and `count()` reflects it.
- [x] `take(n)` returns oldest-first without removing anything.
- [x] `remove(batch)` deletes exactly the given rows, leaving the rest queued.
- [x] `remove()` on a point with no `localId` deletes nothing (guards against
      a coding mistake wiping the queue).
- [x] `clear()` empties the queue.
- [x] Every field round-trips through storage (lat/lng/accuracy/speed/heading/
      battery/isMoving/recordedAt).
- [x] Points survive closing and re-opening the queue against the same store
      (simulates the app being killed mid-flush and restarted).
- [x] Exceeding `maxPoints` (2000) trims exactly the single oldest row.

### `ogera_crm_mobile/test/staff_location_contract_test.dart` (existing — left as-is)

Already covers upload/live/history/403 and was not touched. `reportState()`,
`myRoute()`, and an explicit 500-surfaces-as-`ApiException` case are still
worth adding but are low-risk, low-priority additions on top of what's proven
via `staff_location_session_flow_test.dart` (which already exercises
`reportState()` end-to-end for `location_disabled` and `signed_out`).

### Backend — `tests/api/staff-locations-live.route.test.ts` (done — run and passing)

`managerState()` and `CONNECTION_LOST_AFTER_MS` are now exported from
`src/app/api/staff/locations/live/route.ts` (additive, behavior-preserving)
so they're unit-testable directly, plus the `GET` handler with a mocked DB:

- [x] `location_disabled`/`signed_out` regardless of heartbeat age.
- [x] `connection_lost` once the heartbeat is older than 3 minutes, and when
      it's missing or unparseable; stays fresh at exactly the 3-minute boundary.
- [x] `moving`/`stuck` pass through from `row.state` when the heartbeat is fresh.
- [x] Falls back to `is_moving` for legacy `tracking_enabled` rows.
- [x] `GET`: 403 for `sales_staff`, 401 unauthenticated, numeric coordinates
      in the response, blank name → "Ogera user", 500 doesn't leak the
      underlying DB error.

### Backend — `tests/api/staff-locations-upload.route.test.ts` (done — run and passing)

- [x] 401 unauthenticated / 403 non-staff, no DB call either way.
- [x] 400 on an empty batch, out-of-range lat/long, missing `recordedAt`, or
      a non-boolean `isMoving`.
- [x] Drops a point with an unparseable `recordedAt` but keeps the rest of
      the batch; 400 only when *none* survive.
- [x] `INSERT IGNORE INTO staff_location_history` (idempotent retries).
- [x] The `staff_live_locations` upsert uses the *newest* point in the batch,
      not the last one in array order.
- [x] `last_heartbeat_at = UTC_TIMESTAMP()` is unconditional in the upsert SQL
      (not gated behind the same `IF` as the coordinate columns).
- [x] Moving/Stuck recorded from the newest point's `isMoving`.
- [x] The address-backfill `UPDATE` is skipped when no address resolves.
- [x] 500 doesn't leak the underlying DB error.

### Backend — `tests/api/staff-locations-state.route.test.ts` (done — run and passing, not originally in this checklist)

- [x] 403 for non-staff, 400 for an unknown state value.
- [x] `location_disabled`/`signed_out` each upsert correctly for the caller's
      own id.
- [x] 500 doesn't leak the underlying DB error.

### Backend — `tests/api/staff-locations-helpers.test.ts` (done — run and passing)

- [x] `toSqlUtc()` round-trips valid timestamps, returns `null` for garbage
      or empty input.
- [x] `istDayRangeUtc()` rejects malformed dates and shifts the UTC range by
      the IST offset correctly.
- [x] `routeDistanceMeters()` / `routeStops()`: zero for a single point,
      haversine sum for multiple, stop grouping by the 60 m / 10 min rule.
- [x] `resolveStaffLocationAddress()`: returns the cached address without
      calling the geocoding API; returns `null` (not a thrown error) with no
      API key configured or when the provider fails.

---

## 2. Widget tests

### `ogera_crm_mobile/test/location_gate_screen_test.dart` (done — 7 tests, run and passing)

Uses `NoOpStartTrackingService` (§0) and `tester.pump()` in bounded steps
rather than `pumpAndSettle()`, since `_PulsingPin`'s `..repeat()` animation
never settles.

- [x] Plain "Location sharing is required" + Enable copy before any request
      (`permission == unknown`, i.e. before `adopt()` ever runs).
- [x] `serviceDisabled` and `deniedForever` each show the blocked copy
      matching `_blockedMessage()`, with "Open settings" present.
- [x] "Open settings" calls `openLocationSettings()` for `serviceDisabled`
      and `openAppSettings()` for `deniedForever`.
- [x] Tapping Enable calls through to `requestLocationPermission()` and
      updates `session.permission`/`.status` correctly.
- [x] Sign-out calls through to the auth service.
- [ ] If a Settings nudge for `grantedForeground` gets added later (per the
      gap noted in the tracking-service tests), add a case asserting the gate
      shows it instead of passing the user straight through.

### `ogera_crm_mobile/test/profile_screen_test.dart` (done — 10 tests, run and passing)

Also uses `NoOpStartTrackingService`; pending-count/last-upload state is set
up directly via `queue.add()` + `tracking.flush()`, which doesn't need
`start()` at all.

- [x] "Nothing queued" at zero, "1 point"/"N points" singular/plural once
      queued (via a deliberately failed flush, so the point stays queued).
- [x] "Not yet" before any upload succeeds; a relative time ("just now")
      after one does.
- [x] The debug panel's `Error` line appears only after a failed flush, and
      is absent otherwise.
- [x] Status copy: "sharing while the app is open" (`whileInUse`), "sharing
      in the background" (`always`), and the disabled-services copy.

### `ogera_crm_mobile/test/staff_location_widget_test.dart` (existing — extended, done, run and passing)

- [x] `moving` state renders address, name, and label without raw coordinates
      (pre-existing).
- [x] Address falls back to "Address unavailable" when the server has none.
- [x] `stuck`, `connectionLost`, `locationDisabled` each render their label.
- [x] Low-battery icon + percentage below 20%.
- [x] Tapping the row calls `onFocus`; tapping "Trace" calls `onTrace`.

### `tests/components/staff-live-map.test.tsx` (done — 19 tests, run and passing)

Written against the component's **current** implementation, which has been
redesigned since earlier investigation in this project (filters with counts,
search, a custom `DatePicker`, `formatAgo` instead of `formatRelative`, a
"Close route history" button) — don't assume the older `StaffLiveMap.tsx`
shape described elsewhere still applies.

- [x] Empty state and a server-error message.
- [x] Each of the five states renders its label (`Moving`, `Stuck`, `Location
      disabled`, `Connection lost`, `Signed out`).
- [x] Address fallbacks per state (resolving / disabled-specific / unavailable).
- [x] `formatAgo` boundaries: "just now" (<45s), "N min ago", "N hr ago".
- [x] Selecting a row opens the route dialog and fetches history for today.
- [x] Empty-route message; distance/update-count tiles once points load.
- [x] The date picker's "Next day" control is disabled once viewing today.
- [x] Closing the dialog clears the selection.

---

## 3. Integration tests

### `ogera_crm_mobile/test/staff_location_session_flow_test.dart` (done — 4 tests, run and passing)

Originally planned for `integration_test/`, but this environment has no C++
toolchain to build the real Windows app that `flutter test integration_test/`
launches against (`CMake Error: No CMAKE_CXX_COMPILER could be found`), so it
lives in `test/` instead — nothing here needs a device; it's the real
`LocationTrackingService` + `SessionViewModel` + fakes, run as a plain
`test()` (safe from the §0 hang, which only affects `testWidgets`).

- [x] **Offline → reconnect**: a point recorded while `api.uploadError` is
      set stays queued and unsent; a forced retry after "reconnecting"
      drains the queue and uploads it.
- [x] **Permission revoked mid-session**: after `refreshLocationPermission()`
      sees `denied`, tracking stops, the server is told `location_disabled`,
      and the session falls back to `needsLocation`.
- [x] **Sign out**: tracking stops, the server is told `signed_out`, and the
      queue is cleared (nothing left to leak after the session ends).
- [x] A session that starts blocked (`serviceDisabled`) and is later granted
      (`whileInUse`) begins tracking and the first fix reaches the server.

### `ogera_crm_mobile/integration_test/staff_location_flow_test.dart` (existing, untouched)

- [x] A staff upload becomes visible to head/admin through `live()`
      (API-only, no tracking service involved). Still requires a real device
      / emulator to run via `flutter test integration_test/` — not runnable
      in this environment either, for the same CMake reason above.

### `tests/integration/staff-locations.db.test.ts` — **deliberately not written**

This project's `.env`/`.env.local` point at what appears to be this
business's real database (`tests/integration/*.db.test.ts` connects to
whatever `DATABASE_URL`/`DB_HOST` resolve to, per `vitest.integration.config.mts`).
The existing file in this pattern (`performance.db.test.ts`) is read-only by
design; a staff-locations equivalent would need to `INSERT` rows to test
dedup/upsert behavior, which risks writing test data into a live database.

Not attempted without explicit confirmation of a disposable test database to
point at. If one becomes available, the test should:
- [ ] POST a batch → rows land in `staff_location_history`; POST the same
      batch again → no duplicates (`INSERT IGNORE`).
- [ ] POST → `staff_live_locations` reflects the newest point; an older
      out-of-order POST doesn't roll back coordinates but still bumps
      `last_heartbeat_at`.
- [ ] GET `/live` returns `connection_lost` end-to-end after backdating
      `last_heartbeat_at`.
- [ ] GET `/history` and `/me` scoping and ordering.
- [ ] Role checks end-to-end.
Wrap every write in a transaction that's rolled back, never committed,
regardless of what DB ends up configured.

---

## 4. Manual device QA (not automatable — record results, don't skip)

The core bug this checklist follows up on is an OS background-execution issue;
no unit/widget/integration test can prove Android will actually keep the
process alive. Run these on real devices after any change to
`location_tracking_service.dart` or the manifest:

- [ ] "While using the app" only, app minimized (not swiped away) for 5+ min:
      confirm the "Sharing your location…" notification appears and the
      server receives points during that window (this is what the fix targets).
- [ ] "Allow all the time" granted, same test — should already have worked
      before the fix; use as a control.
- [ ] Swipe the app away from Recents: confirm tracking stops (expected,
      documented limitation — not something to chase as a bug).
- [ ] At least one aggressive-OEM device (Xiaomi/MIUI, Vivo, Oppo, OnePlus)
      with default battery settings, then again after whitelisting the app —
      isolates OEM battery-kill behavior from the permission fix.
- [ ] Airplane mode for 5 minutes, then restore: confirm the backlog uploads
      within the 2-minute retry backoff, not stuck indefinitely.
- [ ] Force-stop the app from Android's app-info screen: confirm the app
      correctly requires a manual reopen (no silent background restart is
      expected here — this is normal Android behavior, not a regression).

---

## Test files added or changed in this pass

- `ogera_crm_mobile/test/fakes/fake_geolocator_platform.dart` (new)
- `ogera_crm_mobile/test/fakes/fake_connectivity_platform.dart` (new, unused
  by the final approach but kept — see §0; may be useful if a future test
  needs to assert on `Connectivity.checkConnectivity()` specifically)
- `ogera_crm_mobile/test/fakes/fake_location_queue.dart` (new)
- `ogera_crm_mobile/test/fakes/fake_location_api_service.dart` (new)
- `ogera_crm_mobile/test/fakes/no_op_start_tracking_service.dart` (new — see §0)
- `ogera_crm_mobile/test/location_tracking_service_test.dart` (new)
- `ogera_crm_mobile/test/location_queue_test.dart` (new)
- `ogera_crm_mobile/test/location_gate_screen_test.dart` (new)
- `ogera_crm_mobile/test/profile_screen_test.dart` (new)
- `ogera_crm_mobile/test/staff_location_widget_test.dart` (extended)
- `ogera_crm_mobile/test/staff_location_session_flow_test.dart` (new)
- `ogera_crm_mobile/pubspec.yaml` — added `fake_async`, `sqflite_common_ffi` dev deps
- `tests/api/staff-locations-live.route.test.ts` (new)
- `tests/api/staff-locations-upload.route.test.ts` (new)
- `tests/api/staff-locations-state.route.test.ts` (new)
- `tests/api/staff-locations-helpers.test.ts` (new)
- `tests/components/staff-live-map.test.tsx` (new)
- `src/app/api/staff/locations/live/route.ts` — exported `managerState`,
  `LiveRow`, `CONNECTION_LOST_AFTER_MS` (additive, behavior-preserving) so
  they're unit-testable

**Confirmed together**: `flutter test` → 151 passed, 2 failed (pre-existing,
unrelated `home_tab.dart` pixel-overflow issue in `shell_screen_test.dart`,
not touched here). `npx vitest run` → 134 passed, 0 failed.

## References

- `ogera_crm_mobile/LOCATION_BACKGROUND_TRACKING_REPORT.md` — root-cause
  investigation this checklist is testing the fix for.
- `ogera_crm_mobile/STAFF_LOCATION_MAP_FLOW.md` — end-to-end product flow.
- `docs/staff-live-location-redesign-checklist.md` — original feature
  checklist; its "Verification and rollout" open item ("Test moving, stuck,
  disabled, delayed/offline, address lookup failure, and authorisation
  states") is what this checklist breaks down concretely and, aside from the
  DB-backed integration test, now completes.
