import TasksBoard from "@/components/tasks/TasksBoard";
import { dmSans, sora } from "@/lib/auth-fonts";

// The Tasks design is set in DM Sans, with Sora for headings and numbers.
export default function TasksPage() {
  return (
    <div className={`${dmSans.variable} ${sora.variable} flex min-h-full flex-col font-[family-name:var(--font-dm-sans)] text-[#1A1C21]`}>
      <TasksBoard />
    </div>
  );
}
