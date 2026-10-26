import type { Metadata } from "next";
import MapWorkspaceLoader from "@/components/MapWorkspaceLoader";

export const metadata: Metadata = { title: "Field Map | Ogera CRM", description: "Live field staff positions and route history" };

export default function FieldMapPage() {
  return <MapWorkspaceLoader />;
}
