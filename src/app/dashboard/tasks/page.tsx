import { Suspense } from "react";
import TasksView from "@/features/tasks/components/TasksView";

export default function TasksPage() {
  // TasksView keeps the tab in ?tab=, which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <TasksView />
    </Suspense>
  );
}
