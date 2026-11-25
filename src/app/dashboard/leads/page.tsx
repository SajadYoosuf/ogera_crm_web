import { Suspense } from "react";
import LeadsView from "@/features/leads/LeadsView";

export default function LeadsPage() {
  // LeadsView reads ?lead= (notification deep link), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <LeadsView />
    </Suspense>
  );
}
