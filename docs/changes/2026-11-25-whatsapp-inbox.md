# WhatsApp inbox (web)

New sidebar page `/dashboard/whatsapp-inbox`: conversation list, message thread and lead info.
The WhatsApp tab in the lead detail modal is removed; the template-send button and the wa.me link stay.

## Files
- `src/features/whatsapp-inbox/` — `api.ts`, `WhatsAppInboxView.tsx` (3 panels, one at a time on phones),
  `ConversationList.tsx`, `MessageThread.tsx` (bubbles + composer moved from the old tab), `LeadInfoPanel.tsx`
  (admin/manager can reassign; everyone gets an "Open lead" link).
- `src/app/dashboard/whatsapp-inbox/page.tsx` — route; reads `?lead=` to pre-select a conversation.
- `DashboardSidebar.tsx` — WhatsApp item with an unread badge (polls every 30 s, refreshed instantly by the
  `ogera-wa-unread-change` event the inbox fires).
- `NotificationBell.tsx` — `whatsapp_inbound` notifications open the inbox instead of the lead page.
- `LeadDetailModal.tsx` — WhatsApp tab removed; `LeadWhatsAppInbox.tsx` deleted.

## Behaviour
- List refreshes every 30 s, the open thread every 10 s, only while the tab is visible.
- Opening a thread marks inbound messages read.
- A hint shows when the customer's last message is over 24 hours old (free text is only allowed inside 24 h).
- Staff only receive their own assigned conversations from the backend; the UI does not filter.

## Tests
`tests/whatsapp-inbox/conversation-list.test.tsx`; the old tab tests in
`tests/leads/whatsapp-inbox-and-roles.test.tsx` now cover `MessageThread`.
Not covered: Playwright e2e and a manual browser pass.
