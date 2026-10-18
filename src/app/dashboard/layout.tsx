import type { Metadata } from "next";
import DashboardSidebar from "@/components/DashboardSidebar";

export const metadata: Metadata = {
  title: "Ogera CRM Dashboard",
  description: "Ogera CRM sales operations portal",
};

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex h-screen bg-[radial-gradient(circle_at_0%_0%,#E7F5EE_0%,transparent_42%),radial-gradient(circle_at_100%_100%,#E0F2FE_0%,transparent_40%),#F4F4FA]">
      <DashboardSidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto overflow-x-hidden">{children}</main>
    </div>
  );
}
