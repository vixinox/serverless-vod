"use client";

import { useEffect } from "react";
import { usePageTransition } from "./transition-context";

/**
 * PageReadySignal
 *
 * Drop this component anywhere in the destination page's JSX.
 * It fires `notifyPageReady()` once on mount, signalling the
 * TransitionProvider that the page has rendered and the reveal animation
 * should begin.
 *
 * It renders nothing — zero visual footprint.
 */
export function PageReadySignal() {
  const { notifyPageReady } = usePageTransition();

  useEffect(() => {
    notifyPageReady();
    // Only call once on mount; exhaustive-deps lint is intentionally suppressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
