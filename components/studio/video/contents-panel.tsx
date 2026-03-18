"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { cn } from "@/lib/utils";
import { PlaylistTable } from "@/components/studio/video/playlist-table";
import { VideoTable } from "@/components/studio/video/video-table";
import { Button } from "@/components/ui/button";

type ContentTab = "video" | "playlist";

export function ContentsPanel() {
  const [activeTab, setActiveTab] = useState<ContentTab>("video");
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!tableContainerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        tableContainerRef.current,
        {
          autoAlpha: 0,
          y: 8,
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.28,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform",
        },
      );
    }, tableContainerRef);

    return () => ctx.revert();
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-16 z-30 flex items-end justify-between bg-studio-background px-6 py-4">
        <h1 className="py-1 text-2xl font-bold">频道内容</h1>
        <div className="flex items-center gap-2 rounded-sm border bg-background p-1">
          <Button
            size="sm"
            variant={activeTab === "video" ? "default" : "ghost"}
            className={cn("rounded-sm", activeTab === "video" ? "shadow-none" : "")}
            onClick={() => setActiveTab("video")}
          >
            视频
          </Button>
          <Button
            size="sm"
            variant={activeTab === "playlist" ? "default" : "ghost"}
            className={cn("rounded-sm", activeTab === "playlist" ? "shadow-none" : "")}
            onClick={() => setActiveTab("playlist")}
          >
            播放列表
          </Button>
        </div>
      </div>

      <div key={activeTab} ref={tableContainerRef}>
        {activeTab === "video" ? <VideoTable /> : <PlaylistTable />}
      </div>
    </div>
  );
}
