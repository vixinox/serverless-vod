"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WatchSidebarData } from "@/lib/server/videos";
import { SmartImage } from "@/components/smart-image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlaylistData = NonNullable<WatchSidebarData["playlist"]>;

function formatViewCount(views: number) {
  if (views >= 10000) {
    return `${(views / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return `${views}`;
}

export function PlaylistPanel({
  shortCode,
  playlist,
}: {
  shortCode: string;
  playlist: PlaylistData;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleId = `playlist-panel-${playlist.id}`;
  const currentPlaylistItem = playlist.items.find((item) => item.video.shortCode === shortCode) ?? null;
  const currentIndex = currentPlaylistItem
    ? playlist.items.findIndex((item) => item.video.shortCode === currentPlaylistItem.video.shortCode)
    : -1;
  const nextVideo = currentIndex >= 0
    ? (playlist.items[currentIndex + 1]?.video ?? null)
    : (playlist.items[0]?.video ?? null);

  useLayoutEffect(() => {
    if (!contentRef.current) return;

    const node = contentRef.current;
    gsap.killTweensOf(node);

    if (expanded) {
      gsap.set(node, { display: "block", height: "auto", opacity: 1, overflow: "hidden" });
      const targetHeight = node.scrollHeight;
      gsap.set(node, { height: 0, opacity: 0 });
      gsap.to(node, {
        height: targetHeight,
        opacity: 1,
        duration: 0.18,
        ease: "power2.out",
        onComplete: () => {
          gsap.set(node, { height: "auto", opacity: 1, overflow: "hidden" });
        },
      });
      return;
    }

    const currentHeight = node.scrollHeight;
    if (currentHeight === 0) {
      gsap.set(node, { display: "none", height: 0, opacity: 0, overflow: "hidden" });
      return;
    }

    gsap.set(node, { display: "block", height: currentHeight, opacity: 1, overflow: "hidden" });
    gsap.to(node, {
      height: 0,
      opacity: 0,
      duration: 0.2,
      ease: "power2.inOut",
      onComplete: () => {
        gsap.set(node, { display: "none", overflow: "hidden" });
      },
    });
  }, [expanded]);

  const handleToggleIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <Card
      className={cn(
        "gap-0 border py-2 transition-colors duration-150 hover:border-border",
      )}
    >
      <CardHeader className="px-3 py-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <p className="truncate text-sm font-semibold">{playlist.title}</p>
            <p className="truncate text-sm text-muted-foreground">
              {nextVideo ? `下一条：${nextVideo.title}` : "已是最后一条"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleIconClick}
            className={cn(
              "inline-flex h-10 w-10 p-2 items-center justify-center rounded-full border text-muted-foreground hover:bg-muted",
            )}
            aria-label={expanded ? "收起播放列表" : "展开播放列表"}
            aria-expanded={expanded}
            aria-controls={titleId}
          >
            {expanded ? <ChevronUp className="size-full" /> : <ChevronDown className="size-full" />}
          </button>
        </div>
      </CardHeader>

      <div id={titleId} ref={contentRef} className="hidden overflow-hidden">
        <CardContent className="space-y-2 px-3 pb-2 pt-1">
          {playlist.items.map((item) => {
            const isCurrent = item.video.shortCode === shortCode;

            return (
              <Link
                key={`${playlist.id}-${item.position}`}
                href={`/watch/${item.video.shortCode}`}
                className={cn(
                  "flex items-start gap-2 rounded-md border px-2 py-1.5 transition-colors hover:bg-accent/40",
                  isCurrent ? "border-primary bg-primary/5" : "border-border/70",
                )}
              >
                <div className="relative w-22 shrink-0 overflow-hidden rounded-sm border bg-muted aspect-video">
                  <SmartImage src={item.video.thumbnail} alt={item.video.title} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-xs font-medium leading-4">{item.video.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatViewCount(item.video.views)} 次观看
                  </p>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </div>
    </Card>
  );
}
