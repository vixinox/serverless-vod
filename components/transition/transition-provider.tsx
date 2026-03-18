"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import {
  TransitionContext,
  type TransitionStatus,
  type TransitionPayload,
  type FadeMaskMode,
  type FadeTransitionOptions,
} from "./transition-context";

const REVEAL_TIMEOUT_MS = 5000;
const THUMBNAIL_FADE_TEST_DELAY_S = 0.5;
const REVEAL_OVERLAY_FADE_DURATION_S = 0.35;
const EXPAND_OVERLAY_FADE_IN_DURATION_S = 0.18;
const FADE_ONLY_COVER_DURATION_S = 0.25;
const EXPAND_THUMBNAIL_DURATION_S = 0.46;

interface Props {
  children: ReactNode;
}

interface OverlayHoleRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export function TransitionProvider({ children }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<TransitionStatus>("idle");
  const [payload, setPayload] = useState<TransitionPayload | null>(null);
  const [overlayHoleRect, setOverlayHoleRect] = useState<OverlayHoleRect | null>(null);

  // DOM refs for the animated elements
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLDivElement | null>(null);
  // Invisible placeholder div that mirrors watch-page layout — used to read the
  // exact target rect for the expand animation instead of manual pixel math.
  const targetRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafIdsRef = useRef<number[]>([]);
  const expandTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const fadeTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const revealTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const finishedRef = useRef(false);
  const expandDoneRef = useRef(false);
  const pendingRevealRef = useRef(false);
  // Guard against multiple rapid clicks
  const isAnimatingRef = useRef(false);
  // true = expand (home→watch), false = fade-only (watch→home)
  const isExpandRef = useRef(false);
  // pending href for fade-only transitions
  const fadePendingRef = useRef<string | null>(null);
  const fadeMaskModeRef = useRef<FadeMaskMode>("full");

  const readOverlayHoleRect = useCallback(
    (maskMode: FadeMaskMode): OverlayHoleRect | null => {
      if (maskMode === "full") return null;

      const selector =
        maskMode === "keep-video"
          ? '[data-transition-keep-visible="video"]'
          : '[data-transition-keep-visible="home-navbar"]';

      const targetEl = document.querySelector<HTMLElement>(selector);
      if (!targetEl) return null;

      const rect = targetEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const left = Math.max(0, Math.min(rect.left, vw));
      const top = Math.max(0, Math.min(rect.top, vh));
      const right = Math.max(left, Math.min(rect.right, vw));
      const bottom = Math.max(top, Math.min(rect.bottom, vh));
      const hasArea = right > left && bottom > top;

      return hasArea ? { top, left, right, bottom } : null;
    },
    []
  );

  const clearRevealTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const cancelScheduledFrames = useCallback(() => {
    if (rafIdsRef.current.length === 0) return;
    for (const id of rafIdsRef.current) {
      cancelAnimationFrame(id);
    }
    rafIdsRef.current = [];
  }, []);

  const nextFrame = useCallback(() => {
    return new Promise<void>((resolve) => {
      const id = requestAnimationFrame(() => {
        rafIdsRef.current = rafIdsRef.current.filter((v) => v !== id);
        resolve();
      });
      rafIdsRef.current.push(id);
    });
  }, []);

  const killTimelines = useCallback(() => {
    expandTimelineRef.current?.kill();
    fadeTimelineRef.current?.kill();
    revealTimelineRef.current?.kill();
    expandTimelineRef.current = null;
    fadeTimelineRef.current = null;
    revealTimelineRef.current = null;
  }, []);

  const finishTransition = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;

    clearRevealTimeout();
    cancelScheduledFrames();
    killTimelines();

    if (isExpandRef.current) {
      window.scrollTo({ top: 0 });
    }

    history.scrollRestoration = "auto";
    isAnimatingRef.current = false;
    isExpandRef.current = false;
    fadePendingRef.current = null;
    fadeMaskModeRef.current = "full";
    expandDoneRef.current = false;
    pendingRevealRef.current = false;
    setStatus("idle");
    setPayload(null);
    setOverlayHoleRect(null);
  }, [cancelScheduledFrames, killTimelines]);

  const runRevealAnimation = useCallback(() => {
    if (!isAnimatingRef.current || finishedRef.current) return;

    clearRevealTimeout();

    // For expand transitions, move to top while overlay is still covering.
    if (isExpandRef.current) {
      window.scrollTo({ top: 0 });
    }

    setStatus("revealing");

    const revealTargets = [overlayRef.current, thumbRef.current].filter(
      Boolean
    ) as HTMLElement[];

    if (revealTargets.length === 0) {
      finishTransition();
      return;
    }

    revealTimelineRef.current?.kill();
    revealTimelineRef.current = gsap.timeline({ onComplete: finishTransition });
    revealTimelineRef.current.to(
      overlayRef.current,
      { opacity: 0, duration: REVEAL_OVERLAY_FADE_DURATION_S, ease: "power2.inOut" },
      0
    );
    if (thumbRef.current) {
      revealTimelineRef.current.to(
        thumbRef.current,
        { opacity: 0, duration: REVEAL_OVERLAY_FADE_DURATION_S, ease: "power2.inOut" },
        THUMBNAIL_FADE_TEST_DELAY_S
      );
    }
  }, [finishTransition]);

  const requestReveal = useCallback(() => {
    if (!isAnimatingRef.current || finishedRef.current) return;

    if (isExpandRef.current && !expandDoneRef.current) {
      pendingRevealRef.current = true;
      return;
    }

    pendingRevealRef.current = false;
    runRevealAnimation();
  }, [runRevealAnimation]);

  const armRevealTimeout = useCallback(() => {
    clearRevealTimeout();
    timeoutRef.current = setTimeout(() => {
      requestReveal();
    }, REVEAL_TIMEOUT_MS);
  }, [requestReveal]);

  const startTransition = useCallback(
    (href: string, thumbnailUrl: string, originRect: DOMRect) => {
      if (isAnimatingRef.current) return;

      finishedRef.current = false;
      isAnimatingRef.current = true;
      isExpandRef.current = true;
      expandDoneRef.current = false;
      pendingRevealRef.current = false;
      setOverlayHoleRect(null);
      // Prevent browser from auto-restoring scroll while animation is playing
      history.scrollRestoration = "manual";

      setPayload({ href, thumbnailUrl, originRect });
      setStatus("animating");

      // Wait for two paint ticks so overlay/thumb are committed before routing.
      void (async () => {
        await nextFrame();
        await nextFrame();

        if (!isAnimatingRef.current || finishedRef.current) return;

        router.push(href, { scroll: false });
        setStatus("covering");

        armRevealTimeout();
      })();
    },
    [armRevealTimeout, nextFrame, router]
  );

  const notifyPageReady = useCallback(() => {
    if (status === "covering" || status === "animating") {
      requestReveal();
    }
  }, [requestReveal, status]);

  /** Fade-only transition: overlay fades in, router.push fires, then reveal. */
  const startFadeTransition = useCallback(
    (href: string, options?: FadeTransitionOptions) => {
      if (isAnimatingRef.current) return;

      const maskMode = options?.maskMode ?? "full";
      fadeMaskModeRef.current = maskMode;
      setOverlayHoleRect(readOverlayHoleRect(maskMode));

      finishedRef.current = false;
      isAnimatingRef.current = true;
      isExpandRef.current = false;
      expandDoneRef.current = true;
      pendingRevealRef.current = false;
      fadePendingRef.current = href;
      setStatus("covering");
      // The overlay mounts on the next React commit; the useEffect below
      // picks it up and kicks off the GSAP fade-in.
    },
    [readOverlayHoleRect]
  );

  // Fade-only animation: runs when status = "covering" with no payload (no expand)
  useEffect(() => {
    if (status !== "covering" || payload !== null || !overlayRef.current) return;
    const href = fadePendingRef.current;
    if (!href) return;

    fadeTimelineRef.current?.kill();
    fadeTimelineRef.current = gsap.timeline();
    fadeTimelineRef.current.fromTo(
      overlayRef.current,
      { opacity: 0 },
      {
        opacity: 1,
        duration: FADE_ONLY_COVER_DURATION_S,
        ease: "power2.inOut",
        onComplete: () => {
          router.push(href, { scroll: false });
          armRevealTimeout();
        },
      }
    );
  }, [armRevealTimeout, payload, router, status]);

  // Run the GSAP expand animation once overlay elements are in the DOM
  useEffect(() => {
    if (status !== "animating" || !payload) return;
    if (!overlayRef.current || !thumbRef.current) return;

    const targetEl = targetRef.current;
    if (!targetEl) return;
    const target = targetEl.getBoundingClientRect();
    const { originRect } = payload;
    const dx = originRect.left - target.left;
    const dy = originRect.top - target.top;
    const sx = originRect.width / target.width;
    const sy = originRect.height / target.height;

    // Fade overlay in quickly during expand so surrounding area doesn't
    // get covered in a single frame.
    gsap.set(overlayRef.current, { opacity: 0 });

    // FLIP: place thumb at final rect and animate transform back to identity.
    gsap.set(thumbRef.current, {
      top: target.top,
      left: target.left,
      width: target.width,
      height: target.height,
      x: dx,
      y: dy,
      scaleX: sx,
      scaleY: sy,
      transformOrigin: "top left",
      opacity: 1,
    });

    expandTimelineRef.current?.kill();
    expandTimelineRef.current = gsap.timeline({
      onComplete: () => {
        expandDoneRef.current = true;
        if (pendingRevealRef.current) {
          requestReveal();
        }
      },
    });

    expandTimelineRef.current.to(
      overlayRef.current,
      {
        opacity: 1,
        duration: EXPAND_OVERLAY_FADE_IN_DURATION_S,
        ease: "power2.out",
      },
      0
    );

    // Thumbnail expands to destination
    expandTimelineRef.current.to(
      thumbRef.current,
      {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        duration: EXPAND_THUMBNAIL_DURATION_S,
        ease: "expo.out",
      },
      0
    );

    // Overlay opacity is held at 1 during expand and only fades on reveal.
  }, [payload, requestReveal, status]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      clearRevealTimeout();
      cancelScheduledFrames();
      killTimelines();
    };
  }, [cancelScheduledFrames, killTimelines]);

  const isActive = status !== "idle";

  return (
    <TransitionContext.Provider value={{ status, startTransition, startFadeTransition, notifyPageReady }}>
      {children}

      {/* ── Invisible placeholder mirrors watch-page layout for target rect ── */}
      {isActive && payload && (
        <div className="fixed inset-0 opacity-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="h-14" />
          <div className="px-[5%] w-full">
            <div className="mt-4 flex w-full flex-col sm:flex-row xl:gap-4 pr-4">
              <div className="flex flex-col w-full xl:w-[75%] 2xl:w-[81%] xl:pr-2">
                <div ref={targetRef} className="w-full aspect-video rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Overlay — sits above page content, below expanding thumbnail ── */}
      {isActive && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-9998 pointer-events-none will-change-[opacity] backface-hidden transform-[translateZ(0)]"
          style={{ opacity: payload ? 1 : 0 }}
        >
          {!payload && overlayHoleRect ? (
            <>
              <div
                className="absolute left-0 top-0 w-full bg-black"
                style={{ height: overlayHoleRect.top }}
              />
              <div
                className="absolute left-0 bg-black"
                style={{
                  top: overlayHoleRect.top,
                  width: overlayHoleRect.left,
                  height: overlayHoleRect.bottom - overlayHoleRect.top,
                }}
              />
              <div
                className="absolute bg-black"
                style={{
                  top: overlayHoleRect.top,
                  left: overlayHoleRect.right,
                  right: 0,
                  height: overlayHoleRect.bottom - overlayHoleRect.top,
                }}
              />
              <div
                className="absolute left-0 w-full bg-black"
                style={{ top: overlayHoleRect.bottom, bottom: 0 }}
              />
            </>
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}
        </div>
      )}

      {/* ── Expanding thumbnail ── */}
      {isActive && payload && (
        <div
          ref={thumbRef}
          className="fixed z-9999 overflow-hidden bg-black rounded-xl will-change-[transform,opacity] backface-hidden transform-[translateZ(0)]"
          style={{
            top: payload.originRect.top,
            left: payload.originRect.left,
            width: payload.originRect.width,
            height: payload.originRect.height,
            pointerEvents: "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payload.thumbnailUrl ?? ""}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        </div>
      )}

      {/* ── Global interaction blocker while animating ── */}
      {isActive && (
        <div className="fixed inset-0 z-10000" />
      )}
    </TransitionContext.Provider>
  );
}