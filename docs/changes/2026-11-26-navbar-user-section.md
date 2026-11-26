# Navbar: move user profile and notification icon from sidebar to page headers

## What changed

**`src/components/NavbarUserSection.tsx`** — new component: notification bell + avatar + name/email, right-aligned, intended for the right side of each page header.

**`src/components/DashboardSidebar.tsx`** — removed the user account block (avatar, name, email, NotificationBell) from the sidebar footer. Added back the fixed mobile hamburger button (top-left, `lg:hidden`) that dispatches `toggleMobileMenu` to open the drawer.

**`src/components/DashboardTopBar.tsx`** — deleted. Its role is fully replaced by `NavbarUserSection` injected into individual page headers, and the mobile hamburger restored to the sidebar.

**`src/app/dashboard/layout.tsx`** — reverted to the original single-main structure (removed the `DashboardTopBar` wrapper that caused a double-header).

**Page headers updated** (import + `<NavbarUserSection />` appended to the right action group):
- `src/features/contacts/ContactsView.tsx`
- `src/features/leads/LeadsView.tsx`
- `src/components/settings/SettingsView.tsx` (header restructured to `justify-between`)
- `src/app/dashboard/employees/page.tsx`
- `src/features/tasks/components/TasksView.tsx` (right div added)

## Access / data impact

None. Display-only change.

## Verification

- `npx tsc --noEmit` — clean, no type errors.
- Not verified in browser (dev server not started). The change is a pure component injection into existing sticky headers with no logic changes.

## Known issues or not done yet

- The dashboard home page (`/dashboard`) header is not updated (it has its own layout). Can be added later if needed.
- The pipeline page header may also benefit from the same treatment.
