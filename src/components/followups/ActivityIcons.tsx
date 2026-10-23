import type { ReactNode } from "react";

const svg = (children: ReactNode, className = "h-4 w-4") => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);

/** One small icon per activity type, shared by the log form, the list and the type tiles. */
export function ActivityTypeIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  switch (type) {
    case "phone_call":
      return svg(<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />, className);
    case "field_visit":
      return svg(<><path d="M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z" /><circle cx="12" cy="10" r="2.5" /></>, className);
    case "whatsapp":
      return <svg className={`${className} text-emerald-600`} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.52 3.48A11.86 11.86 0 0 0 12.05 0C5.5 0 .17 5.33.17 11.88c0 2.09.55 4.13 1.6 5.93L0 24l6.35-1.66a11.86 11.86 0 0 0 5.7 1.45h.01c6.55 0 11.88-5.33 11.88-11.88 0-3.17-1.24-6.16-3.42-8.43ZM12.06 21.8h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.21-3.77.99 1-3.67-.24-.38a9.87 9.87 0 0 1-1.52-5.27c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.98 2.9a9.8 9.8 0 0 1 2.9 6.99c0 5.46-4.44 9.9-9.89 9.9Z" /></svg>;
    case "quote":
      return svg(<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>, className);
    case "demo":
      return svg(<path d="M3 4h18M5 4v10h14V4M12 14v5M8 21l4-2 4 2" />, className);
    case "meeting":
      // Calendar icon
      return svg(<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>, className);
    case "email":
      // Envelope icon
      return svg(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="M2 7l10 7 10-7" /></>, className);
    default:
      return svg(<><path d="M5 4h14v10l-6 6H5Z" /><path d="M13 20v-6h6" /></>, className);
  }
}
