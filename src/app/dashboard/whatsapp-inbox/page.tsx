import { Suspense } from "react";
import WhatsAppInboxView from "@/features/whatsapp-inbox/WhatsAppInboxView";

export default function WhatsAppInboxPage() {
  // WhatsAppInboxView reads ?lead= (notification deep link), which needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <WhatsAppInboxView />
    </Suspense>
  );
}
