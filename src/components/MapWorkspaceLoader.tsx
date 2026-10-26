"use client";

import dynamic from "next/dynamic";

const MapWorkspace = dynamic(() => import("@/components/MapWorkspace"), { ssr: false });

export default function MapWorkspaceLoader() {
  return <MapWorkspace />;
}
