import { DM_Sans, Noto_Sans_Malayalam, Sora } from "next/font/google";

// Fonts for the sign-in screens. Each one sets a CSS variable that the login styles read.
export const sora = Sora({ subsets: ["latin"], weight: ["400", "600", "700", "800"], variable: "--font-sora", display: "swap" });
export const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-dm-sans", display: "swap" });
export const notoMalayalam = Noto_Sans_Malayalam({ subsets: ["malayalam", "latin"], weight: ["500", "600", "700"], variable: "--font-malayalam", display: "swap" });
