/**
 * Avatar colour helpers shared across sales, employees, and contacts.
 *
 * WHY: AVATAR_TINTS in sales and AVATAR_TONES in employees were slightly
 * different copies of the same idea. One source of truth here.
 */

const TINTS = [
  "bg-[#E7F5EE] text-[#0E4D3A]",
  "bg-[#E0F2FE] text-[#075985]",
  "bg-[#FEF3C7] text-[#92400E]",
  "bg-[#FFE4E6] text-[#9F1239]",
  "bg-[#DCFCE7] text-[#167A44]",
  "bg-[#FCE7F3] text-[#A8326E]",
];

/**
 * Returns a Tailwind background + text class pair for an avatar circle,
 * deterministically picked from the first character of the name.
 */
export function avatarTint(name: string): string {
  return TINTS[name.charCodeAt(0) % TINTS.length];
}
