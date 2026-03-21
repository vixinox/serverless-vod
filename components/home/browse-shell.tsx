import { Suspense, type ReactNode } from "react";
import { HomeNavbar } from "@/components/home/home-navbar";
import { FloatingActionRail } from "@/components/home/floating-action-rail";
import { BrowseStage } from "@/components/home/browse-stage";
import { PageReadySignal } from "@/components/transition/page-ready-signal";
import { cn } from "@/lib/utils";

export function BrowseShell({
  children,
  mainClassName,
}: {
  children: ReactNode;
  mainClassName?: string;
}) {
  return (
    <div className="mx-auto min-h-screen w-full">
      <Suspense fallback={null}>
        <HomeNavbar />
      </Suspense>

      <div
        data-transition-keep-visible="home-rail"
        className="fixed right-6 top-1/2 z-10001 hidden -translate-y-1/2 items-center justify-center xl:flex"
      >
        <FloatingActionRail />
      </div>

      <main className={cn("w-full px-[5%] py-6", mainClassName)}>
        <BrowseStage>{children}</BrowseStage>
      </main>

      <PageReadySignal />
    </div>
  );
}
