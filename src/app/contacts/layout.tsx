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
    <div className={`${dmSans.className} flex h-screen bg-[radial-gradient(circle_at_0%_0%,#E7F5EE_0%,transparent_42%),radial-gradient(circle_at_100%_100%,#E0F2FE_0%,transparent_40%),#F4F4FA]`}>
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
