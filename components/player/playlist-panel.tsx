"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { WatchSidebarData } from "@/lib/server/videos";
import { SmartImage } from "@/components/smart-image";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { usePageTransition } from "@/components/transition/transition-context";
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
  const [expanded, setExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const contentId = `playlist-panel-${playlist.id}`;
  const { startFadeTransition } = usePageTransition();
  const currentPlaylistItem = playlist.items.find((item) => item.video.shortCode === shortCode) ?? null;
  const currentIndex = currentPlaylistItem
    ? playlist.items.findIndex((item) => item.video.shortCode === currentPlaylistItem.video.shortCode)
    : -1;
  const currentPosition = currentIndex >= 0 ? currentIndex + 1 : 1;
  const totalItems = playlist.items.length;
  const nextVideo = currentIndex >= 0
    ? (playlist.items[currentIndex + 1]?.video ?? null)
    : (playlist.items[0]?.video ?? null);
  const creatorName = playlist.owner.channel?.name || playlist.owner.name || "创作者";

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

  const handlePlaylistItemClick = (itemShortCode: string) => {
    if (itemShortCode === shortCode) {
      return;
    }

    startFadeTransition(`/watch/${itemShortCode}`, { maskMode: "keep-video" });
  };

  return (
    <Card
      data-transition-keep-visible="playlist"
      className={cn(
        "gap-0 overflow-hidden border py-0 shadow-none transition-colors duration-150 hover:border-border",
      )}
    >
      <CardHeader className="px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex flex-1 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-semibold">{playlist.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {currentPosition} / {totalItems}
              </span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{creatorName}</p>
            {!expanded ? (
              <p className="truncate text-xs text-muted-foreground">
                {nextVideo ? `下一条：${nextVideo.title}` : "已是最后一条"}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleToggleIconClick}
            className={cn(
              "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted",
            )}
            aria-label={expanded ? "收起播放列表" : "展开播放列表"}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            {expanded ? <ChevronUp className="size-5" /> : <ChevronDown className="size-5" />}
          </button>
        </div>
      </CardHeader>

      <div id={contentId} ref={contentRef} className="hidden overflow-hidden">
        <CardContent className="flex max-h-[480px] flex-col gap-0 overflow-y-auto px-0 pb-2 pt-0">
          {playlist.items.map((item, index) => {
            const isCurrent = item.video.shortCode === shortCode;

            return (
              <button
                key={`${playlist.id}-${item.position}`}
                type="button"
                onClick={() => handlePlaylistItemClick(item.video.shortCode)}
                aria-current={isCurrent ? "true" : undefined}
                className={cn(
                  "flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/70",
                  isCurrent && "bg-muted",
                )}
              >
                <span
                  className={cn(
                    "mt-6 w-6 shrink-0 text-center text-xs text-muted-foreground",
                    isCurrent && "font-medium text-foreground",
                  )}
                >
                  {index + 1}
                </span>
                <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-sm bg-muted">
                  <SmartImage
                    src={item.video.thumbnail}
                    alt={item.video.title}
                    sizes="96px"
                  />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="line-clamp-2 text-xs font-medium leading-4">{item.video.title}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {formatViewCount(item.video.views)} 次观看
                  </p>
                </div>
              </button>
            );
          })}
        </CardContent>
      </div>
    </Card>
  );
}
