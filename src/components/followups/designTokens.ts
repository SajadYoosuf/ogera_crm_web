import type { CSSProperties } from "react";


/** Values from tokens.json and README_DESIGN_SYSTEM.md. Keep in sync with that file. */
export const COLOR = {
  brandDeep: "#0E4D3A",
  accent: "#0E7A4F",
  accentTint08: "rgba(14,122,79,0.08)",
  accentTint06: "rgba(14,122,79,0.06)",
  surfaceWhite: "#FFFFFF",
  surfaceMuted: "#F0F0F3",
  borderDefault: "#E5E7EA",
  borderStrong: "#DEE1E5",
  textHeading: "#0E4D3A",
  textBody: "#3A3E4A",
  textSecondary: "#4B5060",
  textMuted: "#8A8F9C",
  textFaint: "#9AA0AC",
  danger: "#B42323",
  dangerBg: "#FDECEC",
  overlay: "rgba(17,18,20,0.45)",
} as const;

export const SHADOW = {
  dropdown: "0 12px 28px rgba(16,24,40,0.16)",
  modal: "0 24px 64px rgba(16,24,40,0.28)",
  drawer: "-24px 0 64px rgba(16,24,40,0.28)",
} as const;

export const FONT = {
  heading: "'Sora', system-ui, sans-serif",
  body: "'DM Sans', system-ui, sans-serif",
} as const;

export const TYPE = {
  h3PanelTitle: { fontFamily: FONT.heading, fontSize: 17, lineHeight: "24px", fontWeight: 700 },
  bodyMd: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: "20px", fontWeight: 500 },
  bodySm: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: "18px", fontWeight: 500 },
  label: { fontFamily: FONT.body, fontSize: 12, lineHeight: "16px", fontWeight: 600 },
  caption: { fontFamily: FONT.body, fontSize: 11.5, lineHeight: "16px", fontWeight: 500 },
  buttonLabel: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: "20px", fontWeight: 600 },
} as const satisfies Record<string, CSSProperties>;

export const BUTTON_PRIMARY: CSSProperties = {
  ...TYPE.buttonLabel,
  background: COLOR.accent,
  color: COLOR.surfaceWhite,
  border: "none",
  borderRadius: 8,
  padding: "9px 16px",
  cursor: "pointer",
};

export const BUTTON_SECONDARY: CSSProperties = {
  ...TYPE.buttonLabel,
  background: COLOR.surfaceWhite,
  color: COLOR.textBody,
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: 8,
  padding: "9px 16px",
  cursor: "pointer",
};

export const MODAL_FIELD_LABEL: CSSProperties = { fontSize: 13, fontWeight: 600, color: "#3A3F46" };

export const MODAL_INPUT: CSSProperties = {
  height: 42,
  border: `1px solid ${COLOR.borderStrong}`,
  borderRadius: 8,
  padding: "0 12px",
  fontFamily: "inherit",
  fontSize: 14,
  color: "#1A1C21",
  background: COLOR.surfaceWhite,
  boxSizing: "border-box",
  width: "100%",
};

/** Focus ring for native inputs, selects and date/time fields in modals. */
export const MODAL_FIELD_CLASS = "transition-colors focus:outline-none focus:border-[#0E7A4F] focus:ring-2 focus:ring-[#BFE6D2]";

export const MODAL_CANCEL: CSSProperties = {
  height: 40,
  padding: "0 16px",
  border: `1px solid ${COLOR.borderStrong}`,
  background: COLOR.surfaceWhite,
  borderRadius: 8,
  color: COLOR.textBody,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};

export const MODAL_SAVE: CSSProperties = {
  height: 40,
  padding: "0 20px",
  border: "none",
  background: COLOR.accent,
  borderRadius: 8,
  color: COLOR.surfaceWhite,
  fontFamily: "inherit",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
};

/** Activity-type icon tiles (tokens: activity-*). Message/Partner and Field/Dealer reuse the pill pairs. */
export const ACTIVITY_TILE: Record<string, { bg: string; fg: string }> = {
  phone_call: { bg: "#EAF2FE", fg: "#1565D8" },
  whatsapp: { bg: "#E7F8EE", fg: "#1F9254" },
  quote: { bg: "#EAF8EF", fg: "#0E7A4F" },
  field_visit: { bg: "#FFF3E0", fg: "#B45309" },
  meeting: { bg: "#F3EEFF", fg: "#5B3FD6" },
  email: { bg: "#FFF0FB", fg: "#9C2BAD" },
};
export const ACTIVITY_TILE_DEFAULT = { bg: COLOR.surfaceMuted, fg: COLOR.textSecondary };

/** Follow-up status pills (tokens: status-*). */
export const TASK_STATUS: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "#F0F0F3", fg: "#4B5060" },
  due_today: { bg: "#FFF7E6", fg: "#9A5B00" },
  overdue: { bg: "#FDECEC", fg: "#B42323" },
  done: { bg: "#EAF8EF", fg: "#17703F" },
};

/** Contact-type pills (tokens: consumer-*, partner-*, dealer-*). */
export const KIND_PILL: Record<"consumer" | "partner" | "dealer", { bg: string; fg: string }> = {
  consumer: { bg: "#EEF4FF", fg: "#1D5BBF" },
  partner: { bg: "#F1EDFF", fg: "#5B3FD6" },
  dealer: { bg: "#FFF3E0", fg: "#B45309" },
};
