---
name: responsive-ui
description: Make every new or changed UI feature work on phone, tablet and desktop without breaking the layout, and check this automatically without the user asking. Use this whenever building or editing a page, layout, sidebar, navigation, table, card grid, form, dialog, modal, drawer or any visible component, and whenever the user mentions mobile, tablet, responsive, breakpoint, bottom sheet, toggle menu, overflow or "looks broken on phone" - even if they never say "responsive".
---

# Responsive UI for new features

The target is "works and looks tidy everywhere", not pixel-perfect polish. Nothing should overflow, overlap, get cut off, or become impossible to tap. Do this check on every UI change by default; the user should never have to ask for it.

## Device targets

Design mobile-first, then widen. Use the project's Tailwind breakpoints (or the existing CSS breakpoints in `globals.css` if the feature is styled there).

| Device | Width to check | Layout goal |
| --- | --- | --- |
| Phone | 360-430 px | One column, stacked, thumb-friendly |
| Tablet | 768-1024 px | Two columns or collapsed nav; nothing stretched or cramped |
| Desktop | 1280 px and up | Full layout with persistent navigation, content capped to a readable width |

Anything at 320 px should still be usable, just not pretty.

## Pattern for each common element

Pick the mobile treatment that keeps the desktop design intact and swap it below the breakpoint.

| Element | Desktop | Phone / tablet |
| --- | --- | --- |
| **Navigation / sidebar** | Fixed sidebar, always visible | Hidden; a menu (toggle) button opens it as an overlay drawer with a backdrop. Close on link tap, backdrop tap and Escape. See `src/components/DashboardSidebar.tsx` for the existing `lg:` pattern - follow it. |
| **Modal / dialog with a form** | Centered card, capped width (`max-w-lg`), `max-h` with internal scroll | Bottom sheet: anchored to the bottom, full width, rounded top corners, `max-h-[90dvh]`, content scrolls inside, header and action buttons stay reachable. Use `dvh`, not `vh`, so mobile browser bars don't hide buttons. |
| **Data tables** | Normal table | Wrap in `overflow-x-auto`, or restack rows as cards when there are few columns. Never let the page itself scroll sideways. |
| **Card / stat grids** | 3-4 columns | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/4` |
| **Form layouts** | Two-column fields where it helps | Single column, full-width inputs, labels above fields |
| **Toolbars / filter rows** | One row | Wrap (`flex-wrap`) or collapse extra filters behind a "Filters" button |
| **Maps and fixed-height panels** | Fixed or side-by-side | Give an explicit height (e.g. `h-[60dvh]`) and stack below or above the list |
| **Page padding** | Generous | Smaller gutters (`px-4 sm:px-6 lg:px-8`) |

## Details that stop layouts breaking

- Put `min-w-0` on flex/grid children that hold long text so they can shrink; add `truncate` or `break-words` to names, emails and addresses.
- Avoid fixed pixel widths on containers; prefer `w-full` plus `max-w-*`.
- Tap targets at least about 40 px tall; keep enough spacing between adjacent buttons.
- Inputs use at least 16 px font on phones, otherwise iOS zooms the page on focus.
- Lock background scroll while a drawer or modal is open, and restore it on close.
- Modal actions: on phones stack full-width buttons (primary first or last, consistently); on desktop align right in a row.
- Keep the mobile menu button out of the way of page titles (reserve top padding rather than overlapping content).
- Test with long text, many items and zero items - layouts usually break on the data, not the width.

## Checking without being asked

After implementing, verify before reporting done:

1. Read through the classes/CSS and confirm every fixed-width, multi-column or side-by-side element has a smaller-screen rule.
2. If the app can run, open it and look at three widths (about 390, 820 and 1280 px) using browser devtools or a screenshot tool, and scroll the page. Look for horizontal scroll, clipped buttons, overlapping items and unreachable actions.
3. If you cannot run it, say so plainly and list which breakpoint rules you added instead of claiming it was tested.

## Keep it proportionate

Do not build separate mobile and desktop versions of a component when one component with breakpoint classes works. Do not add animations, gestures (swipe to dismiss) or extra breakpoints unless the feature needs them. If the existing code already handles a case (for example a shared modal shell), reuse it.

## Report

Finish with one or two lines: the devices/widths covered, how the layout changes (for example "sidebar on desktop, toggle drawer below 1024 px; form modal becomes a bottom sheet on phones"), and anything you could not verify.
