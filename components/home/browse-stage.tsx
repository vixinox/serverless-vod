"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import gsap from "gsap";

export function BrowseStage({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    const ctx = gsap.context(() => {
      const items = Array.from(
        root.querySelectorAll<HTMLElement>("[data-home-animate]")
      );
      const fallbackTargets = Array.from(root.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement
      );
      const targets = items.length > 0 ? items : fallbackTargets;

      if (targets.length === 0) {
        return;
      }

      gsap.fromTo(
        targets,
        {
          autoAlpha: 0,
          y: 22,
          scale: 0.985,
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.58,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "all",
        }
      );
    }, root);

    return () => {
      ctx.revert();
    };
  }, [routeKey]);

  return <div ref={rootRef}>{children}</div>;
}
