import type { Metadata } from "next";
import DashboardSidebar from "@/components/DashboardSidebar";

export const metadata: Metadata = {
  title: "Ogera CRM Dashboard",
  description: "Ogera CRM sales operations portal",
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex h-screen bg-gray-50">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
