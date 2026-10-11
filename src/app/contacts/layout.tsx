import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import DashboardSidebar from "@/components/DashboardSidebar";

// The Contacts design is set in DM Sans (the login page loads it the same way).
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "Contacts · Ogera CRM",
  description: "Find, add and manage everyone in your Ogera CRM pipeline",
};

export default function ContactsLayout({ children }: LayoutProps<"/contacts">) {
  return (
    <div className={`${dmSans.className} flex h-screen bg-white`}>
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
