# Staff live location redesign checklist

## Product contract

- [x] Restrict team live-location visibility to admins and sales heads on web and mobile.
- [x] Keep staff out of the team live-location view; staff tracking runs silently after sign-in.
- [x] Use one staff identity colour consistently on the map, list, and route detail.
- [x] Define the manager-visible states: Moving, Stuck, Location disabled, and Connection lost.
- [x] Keep capture timestamps internally for route history; never render raw coordinates as user-facing text.

## Mobile reporting

- [x] Capture and queue the staff member's latest latitude and longitude every 60 seconds.
- [x] Send Moving or Stuck with each queued point.
- [x] Report Location disabled when location permission or the device location service is unavailable.
- [x] Preserve queued points during a network outage and retry after connectivity returns.

## Backend and database

- [x] Add readable address, tracking state, heartbeat timestamp, and address-cache storage without altering existing data.
- [x] Reverse-geocode server-side and cache the result before saving it with the latest location.
- [x] Store route timestamps internally, address and status with historical points, and no client-supplied staff id.
- [x] Derive Connection lost when no successful heartbeat has reached the server for three minutes.
- [x] Return readable addresses and derived status to authorised manager clients.

## Manager experience

- [x] Replace the simulated web staff map with live database data.
- [x] Show staff rows and pins with a stable per-employee colour, current address, status, and last update.
- [x] Open a route-history dialog when a staff member is selected; show map route, address, status, and time without coordinates.
- [x] Use the same server-provided address/status contract on the manager mobile map and route sheet.

## Verification and rollout

- [x] Type-check the backend and analyse the Flutter app.
- [x] Apply and verify the additive migration on the live database.
- [ ] Test moving, stuck, disabled, delayed/offline, address lookup failure, and authorisation states.

## Operational limits

- A phone cannot report while it has no network. The server therefore shows Connection lost only after the last successful heartbeat becomes overdue; queued points sync when connectivity returns.
- Mobile operating systems can defer background work, especially after an app is force-closed. Android foreground location and iOS background permission remain required for best-effort 60-second updates.
