"use client";

import { useEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export function ChannelPageIntro({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const ctx = gsap.context(() => {
      const items = root.querySelectorAll<HTMLElement>("[data-channel-animate]");

      if (items.length === 0) {
        return;
      }

      gsap.fromTo(
        items,
        {
          opacity: 0,
          y: 24,
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          clearProps: "all",
        },
      );
    }, root);

    return () => {
      ctx.revert();
    };
  }, []);

  return <div ref={rootRef}>{children}</div>;
}
