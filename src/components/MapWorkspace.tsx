"use client";

import dynamic from "next/dynamic";

const StaffLiveMap = dynamic(() => import("@/components/StaffLiveMap"), { ssr: false });

export default function MapWorkspace() {
  return <StaffLiveMap />;
}
