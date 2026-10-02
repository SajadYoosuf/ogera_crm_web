"use client";

import dynamic from "next/dynamic";

// Leaflet touches `window` at module scope, so every map view is client-only.
const MapWorkspace = dynamic(() => import("@/components/MapWorkspace"), { ssr: false });

export default function MapWorkspaceLoader() {
  return <MapWorkspace />;
}
