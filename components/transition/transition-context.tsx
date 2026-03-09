"use client";

import { createContext, useContext } from "react";

export type TransitionStatus = "idle" | "animating" | "covering" | "revealing";

export interface TransitionPayload {
  href: string;
  thumbnailUrl: string;
  originRect: DOMRect;
}

export type FadeMaskMode = "full" | "keep-video" | "keep-home-navbar";

export interface FadeTransitionOptions {
  maskMode?: FadeMaskMode;
}

export interface TransitionContextValue {
  status: TransitionStatus;
  /**
   * Trigger a thumbnail-expand page transition (home → watch).
   * @param href - the destination URL
   * @param thumbnailUrl - absolute or relative URL for the cover image
   * @param originRect - bounding rect of the source thumbnail element
   */
  startTransition: (
    href: string,
    thumbnailUrl: string,
    originRect: DOMRect
  ) => void;
  /**
   * Trigger a fade-only page transition (e.g. watch → home).
   * @param href - the destination URL
   */
  startFadeTransition: (href: string, options?: FadeTransitionOptions) => void;
  /**
   * Called by the destination page once it has fully mounted and is ready
   * to be displayed.
   */
  notifyPageReady: () => void;
}

export const TransitionContext = createContext<TransitionContextValue>({
  status: "idle",
  startTransition: () => {},
  startFadeTransition: () => {},
  notifyPageReady: () => {},
});

export function usePageTransition() {
  return useContext(TransitionContext);
}
