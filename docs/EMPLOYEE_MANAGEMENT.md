# Employee Management

The Employees screen (`/dashboard/employees`) lets admins and managers see the team, add people, change their role, access and details, and remove them. Staff accounts are the same records that sign in (see [FRONTEND_AUTHENTICATION.md](./FRONTEND_AUTHENTICATION.md)). The API is documented in the root `API.md` under **Employees**.

## Who can use it

| Viewer role | Opens the screen | Sees in the list | Can add | Can edit / delete |
| --- | --- | --- | --- | --- |
| `admin` | Yes | Everyone except admin accounts (including their own) | Any role | Anyone listed. Their own account is not listed, so it cannot be edited here. |
| `manager` | Yes | Everyone except admins and managers (including themselves) | Any role except admin and manager | Non-manager, non-admin employees |
| Any other role | No. Shows "Restricted area" and makes no API call | Nothing | No | No |

The visibility rule comes from `rule.md` section 3 and is enforced by the backend (`routes/employees.py`, `HIDDEN_FROM_LIST` and `HIDDEN_FROM_MANAGER`). Hidden accounts also return `404` from `GET /employees/{id}`, so they cannot be reached by id either.

Permissions enforced by the backend:

| Action | Rule | Error |
| --- | --- | --- |
| Assign or change to `admin` / `manager` | Admin only | `403` "Only an admin can assign the manager role" |
| Modify or delete an admin or manager (not yourself) | Admin only | `403` "Only an admin can modify a manager" |
| Deactivate yourself or change your own role | Not allowed | `400` "You cannot deactivate or change the role of your own account" |
| Delete yourself | Not allowed | `400` "You cannot delete your own account" |
| Role not in the role table, or inactive | Not allowed | `422` "Role '<slug>' does not exist" / "is inactive" |
| Email already used (including soft-deleted accounts) | Not allowed | `409` "Email already in use" |
| Phone already used | Not allowed | `409` "An employee with this phone number already exists" |

Custom roles created through `/roles` are valid for `role` on the API. The frontend does not yet read that table (see Known gaps).

## Screen layout

Header (72 px, sticky): title **Employees**, **Export** and **Add Employee**.

Toolbar: search box ("Search by name or email…") on the left; on the right a **Role** dropdown and a refresh icon.

List:
- **Wide screens (`xl` and up):** a table with Full name (avatar, "You" badge on your own row), Email (mailto link), Role, Status (Active / Inactive pill), Phone number, and Actions (Edit, Delete). Clicking a row opens the details dialog.
- **Smaller screens:** one card per employee with the same details and icon buttons for Edit and Delete.
- **Pagination:** 10 per page, "Showing X to Y of Z employees", numbered page buttons, Previous and Next. The page returns to 1 when a search or filter changes.

Role dropdown: lists the seven roles (`EMPLOYEE_ROLES`). The button reads "Role" until a role is chosen, then "Role: <role>". Choosing the same role again clears it.

Export: downloads the currently filtered list as `employees-YYYY-MM-DD.csv` with Name, Email, Phone, Role, Status and Joined. Cells starting with `=`, `+`, `-` or `@` are prefixed with `'` to block spreadsheet formulas. Export is disabled when nothing is listed.

### Add and edit form

Opens from **Add Employee**, the row's Edit, or the details dialog's Edit. It is a full screen on phones and a dialog on larger screens.

| Field | Add | Edit | Rule |
| --- | --- | --- | --- |
| Full name | Required | Changeable | Up to 120 characters. |
| Email | Required | Changeable | Browser email format check. The backend checks it again and rejects duplicates with `409`. |
| Phone | Optional | Changeable | Indian mobile: 10 digits, starting 6–9, with a `+91` prefix sent. Only checked when the number is new or edited, so an existing non-Indian number does not block other edits. Typed `+91…`, `0…` and spaces are cleaned automatically. |
| Role | Defaults to Sales executive | Changeable | Admins see every role; managers see every role except admin and manager. A user cannot change their own role. |
| Password | Required | Optional ("Leave blank to keep current") | At least 8 characters with a letter and a digit (client). Show/hide, **Generate** (12 characters, always has upper case, lower case and a digit), and copy. The backend also accepts 6 to 15 characters. |
| Account active | Not shown | Checkbox | Unticking sends `is_active: false`. Disabled for your own account. |

Only fields that changed are sent on edit. Saving with no changes shows "No changes to save."

Success messages appear in a green bar under the header for a few seconds: "<name> was added to the team.", "<name> was updated.", "<name> was removed."

Field Staff is **not** shown or sent from this screen (removed because the `field_executive` role covers field work). The API still stores `is_field_staff`, and existing values are left alone.

### Details dialog

Opens when a row or card is clicked. It fetches `GET /employees/{id}` to refresh the record. If that request fails, the list data is kept. It shows email, phone, member since and last updated. Admins and managers who may modify the person get **Delete** and **Edit**; otherwise the footer shows **Email** (a mailto link) and a note "Only an admin can modify another admin or manager."

### Delete

A confirmation dialog names the employee: "<name> will no longer be able to sign in. Their email stays reserved and their records are kept." Delete is a soft delete: `DELETE /employees/{id}` sets `deleted_at`, and the row disappears from the list.

## UI states

| State | Trigger | What the user sees |
| --- | --- | --- |
| Restricted | Viewer role is not admin or manager | "Restricted area" card. No API call. |
| Loading | First load, refresh, or after a save or delete | Skeleton rows; the refresh icon spins. |
| Ready | List loaded | Table or cards, pagination, result count. |
| Empty (no employees) | Team list is empty | "No employees yet" with **Add employee**. |
| Empty (no matches) | Search or filter matches nothing | "No matches found" with **Clear filters**. |
| Session expired | `401` on the list | "Session expired" with **Sign in again** (to `/`). |
| Access denied | `403` on the list | "Access denied". |
| Offline | Browser offline, or a request fails with no connection | "You're offline" card. The list reloads by itself when the connection returns. A banner appears when the list is already shown. |
| Server or network error | `5xx`, timeout, or unreachable | "Couldn't load employees" or "Can't reach the server", with **Try again**. |
| Saving | Form submitted | Button reads "Saving…" and is disabled. |
| Save failed | Any save error | Message above the buttons; the form stays open. `401` returns to the login screen. |
| Delete failed | Any delete error | Message in the confirmation dialog; the employee stays listed. |

## Data and API calls

| Action | Request | Notes |
| --- | --- | --- |
| Load list | `GET /employees?skip=N&limit=100` repeated | `listAllEmployees()` fetches pages of 100 up to 10 pages (1,000 employees), then filters in the browser. |
| Open details | `GET /employees/{id}` | Refreshes the record shown in the dialog. |
| Add | `POST /employees` | Body: `name`, `email`, `role`, `password`, optional `phone` (`+91…`). |
| Edit | `PUT /employees/{id}` | Body: only the changed fields. Clearing the phone sends `phone: null`. |
| Delete | `DELETE /employees/{id}` | `204` on success. |

Response shape (`Employee`, from `src/lib/api/auth.ts`): `id`, `name`, `email`, `role`, `is_field_staff`, `phone`, `is_active`, `created_at`, `updated_at`, `deleted_at`. The API shape is in `API.md` under `EmployeeResponse`.

Phone numbers from the API are shown as `+91 98765 43210` when they match `+91` followed by ten digits; anything else is shown unchanged.

## Files

| File | Responsibility |
| --- | --- |
| `src/app/dashboard/employees/page.tsx` | The screen: toolbar, table, cards, pagination, export, details, delete, add/edit form. |
| `src/lib/api/employees.ts` | Typed client: `listEmployees`, `listAllEmployees`, `getEmployee`, `createEmployee`, `updateEmployee`, `deleteEmployee`; `EMPLOYEE_ROLES`; `canManageEmployees`, `canModifyEmployee`, `assignableRoles`, `isPrivilegedRole`. |
| `src/lib/api/auth.ts` | Shared `request()`, `ApiError` and error mapping. |
| `src/components/FilterSelect.tsx` | Role dropdown (`fit`, `clearable`). |
| `src/hooks/useOnlineStatus.ts` | Online/offline state for the offline banner and auto-reload. |
| `e2e/employees.spec.ts` | 32 end-to-end tests, run on desktop and mobile (64 runs). |
| `e2e/fixtures/api.ts` | Mock FastAPI. `mockApi(page, { employees, viewer })` applies the visibility rule; `failRequest()` makes the next matching request fail. |
| `tests/api/employees-client.test.ts` | Unit tests for the client (8 tests). |
| `docs/changes/2026-10-15-employees-redesign.md` | Change notes for the redesign. |

## Known gaps

- **Admins cannot manage their own account here.** The backend hides admin accounts from the list, so an admin's own row never appears. Profile and password changes for an admin need another route.
- **Managers cannot see themselves either.** The frontend's "anyone may edit themselves" rule is never reached for managers.
- **Role list is fixed.** `EMPLOYEE_ROLES` mirrors the seven built-in roles. Roles added through `/roles` do not appear in the dropdown or the add form until the frontend reads the role table.
- **Field staff is hidden from the UI.** The backend still stores it, and mobile or location features may still use it. Confirm before removing it from the API.
- **Joined date filter removed.** The design has a Joined date button, but no option set was agreed, so it is not built.
- **No bulk actions.** The design's row checkboxes are not built because there is no bulk action to attach them to.
- **Listing is capped.** The browser loads at most 1,000 visible employees. Larger teams need server-side paging.
- **No live refresh.** If another admin changes a record, the list shows the old values until **Refresh** is pressed or the page reloads.
- **Silent detail failure.** If `GET /employees/{id}` fails, the dialog uses the list data without an error message.
- **Forgot password is not connected to this screen.** See [FRONTEND_AUTHENTICATION.md](./FRONTEND_AUTHENTICATION.md) for the mismatch between the frontend and the backend reset endpoints.
