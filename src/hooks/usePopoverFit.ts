"use client";

import { type CSSProperties, type RefObject, useLayoutEffect, useState } from "react";

const EDGE_GAP = 8;

/**
 * Inline position for a dropdown list that opens under its trigger. It slides sideways so the list
 * stays inside the screen: a list opened from a button near the left or right edge would otherwise be
 * pushed off-screen, where it looks empty and can't be tapped. Spread the result onto the list's `style`.
 */
export function usePopoverFit<T extends HTMLElement>(open: boolean, anchorRef: RefObject<T | null>, minWidth: number): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({ left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const anchor = anchorRef.current.getBoundingClientRect();
    const viewport = document.documentElement.clientWidth;
    const width = Math.min(Math.max(minWidth, anchor.width), viewport - EDGE_GAP * 2);
    const left = Math.min(Math.max(EDGE_GAP, anchor.left), viewport - EDGE_GAP - width);
    setStyle({ left: left - anchor.left, width });
  }, [open, anchorRef, minWidth]);

  return style;
}
