"use client";

import { type CSSProperties, type RefObject, useLayoutEffect, useState } from "react";

const EDGE_GAP = 8;
const LIST_GAP = 6;

/**
 * Fixed-position placement for a dropdown list that is rendered through a portal (into <body>).
 *
 * Use it for lists opened from inside a table or any `overflow: hidden/auto` container: an absolutely
 * positioned list there is clipped by the container, so rows near the bottom show an empty or cut-off menu.
 * The list opens below its trigger, or above it when there is not enough room underneath. It also stays
 * inside the screen horizontally, and it recalculates on scroll and resize while open.
 * Spread the result onto the list's `style`.
 */
export function useFloatingPopover<T extends HTMLElement>(open: boolean, anchorRef: RefObject<T | null>, minWidth: number, maxListHeight = 288): CSSProperties {
  const [style, setStyle] = useState<CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(Math.max(minWidth, anchor.width), viewportWidth - EDGE_GAP * 2);
      const left = Math.min(Math.max(EDGE_GAP, anchor.left), viewportWidth - EDGE_GAP - width);

      const spaceBelow = viewportHeight - anchor.bottom - LIST_GAP - EDGE_GAP;
      const spaceAbove = anchor.top - LIST_GAP - EDGE_GAP;
      const openUp = spaceBelow < Math.min(maxListHeight, 200) && spaceAbove > spaceBelow;

      setStyle(openUp
        ? { position: "fixed", left, width, top: "auto", bottom: viewportHeight - anchor.top + LIST_GAP, maxHeight: Math.max(120, Math.min(maxListHeight, spaceAbove)) }
        : { position: "fixed", left, width, bottom: "auto", top: anchor.bottom + LIST_GAP, maxHeight: Math.max(120, Math.min(maxListHeight, spaceBelow)) });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, minWidth, maxListHeight]);

  return style;
}
