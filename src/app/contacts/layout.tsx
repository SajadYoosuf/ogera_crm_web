import type { Metadata } from "next";
import DashboardSidebar from "@/components/DashboardSidebar";

export const metadata: Metadata = {
  title: "Contacts · Ogera CRM",
  description: "Find, add and manage everyone in your Ogera CRM pipeline",
};

export default function ContactsLayout({ children }: LayoutProps<"/contacts">) {
  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
