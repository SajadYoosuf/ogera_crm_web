import DashboardHome from "@/components/dashboard/DashboardHome";
import { dmSans, sora } from "@/lib/auth-fonts";

// The dashboard uses the same type as Tasks: DM Sans for text, Sora for headings and numbers.
export default function DashboardPage() {
  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <DashboardHome />
    </div>
  );
}
