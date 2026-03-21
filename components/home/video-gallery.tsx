'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { VideoCard } from "./video-card";
import { apiRequest } from "@/lib/api-client";
import type { GalleryVideoData as VideoData } from "@/lib/server/videos";

function useResponsiveCols(breakpoints: { width: number, cols: number }[]) {
  const [cols, setCols] = useState(breakpoints[0].cols);

  useEffect(() => {
    function updateCols() {
      const w = window.innerWidth;
      let matched = breakpoints[0].cols;
      for (const bp of breakpoints) {
        if (w >= bp.width) matched = bp.cols;
      }
      setCols(matched);
    }

    updateCols();
    window.addEventListener('resize', updateCols);
    return () => window.removeEventListener('resize', updateCols);
  }, [breakpoints]);
  return cols;
}

export function VideoGallery() {
  const cols = useResponsiveCols([
    { width: 0, cols: 3 },
    { width: 1080, cols: 4 },
    { width: 2561, cols: 5 }
  ]);

  const [videos, setVideos] = useState<VideoData[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const animatedCardCountRef = useRef(0);

  useEffect(() => {
    (async () => {
      try {
        const { items, nextCursor } = await apiRequest<{ items: VideoData[]; nextCursor: string | null }>("/api/videos");
        setVideos(items);
        setCursor(nextCursor);
      } catch (error) {
        console.error("Failed to load videos", error);
      } finally {
        setIsInitialLoaded(true);
      }
    })()
  }, []);

  const canLoadMore = isInitialLoaded && cursor !== null;
  const showEmptyState = isInitialLoaded && videos.length === 0;

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (cursor) {
        params.set("cursor", cursor);
      }

      const { items, nextCursor } = await apiRequest<{ items: VideoData[]; nextCursor: string | null }>(
        `/api/videos?${params.toString()}`
      );

      if (items.length > 0) {
        setVideos(prev => [...prev, ...items]);
      }

      setCursor(nextCursor);
    } catch (error) {
      console.error("Failed to load more videos", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [canLoadMore, isLoadingMore, cursor]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMore();
        }
      },
      { root: null, rootMargin: "200px 0px", threshold: 0 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [handleLoadMore]);

  useEffect(() => {
    if (showEmptyState) {
      animatedCardCountRef.current = 0;
      return;
    }

    const grid = gridRef.current;
    if (!grid) return;

    const cards = Array.from(
      grid.querySelectorAll<HTMLElement>("[data-gallery-card]")
    );

    if (cards.length === 0) return;

    const startIndex = Math.min(animatedCardCountRef.current, cards.length);
    const nextCards = cards.slice(startIndex);

    if (nextCards.length === 0) return;

    gsap.fromTo(
      nextCards,
      {
        autoAlpha: 0,
        y: 20,
        scale: 0.985,
      },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.56,
        ease: "power3.out",
        stagger: 0.05,
        clearProps: "all",
      }
    );

    animatedCardCountRef.current = cards.length;
  }, [showEmptyState, videos.length]);

  return (
    <div className="w-full flex flex-col gap-4" data-home-animate>

      {showEmptyState ? (
        <div className="mx-auto mt-10 flex min-h-[45vh] w-full max-w-4xl items-center justify-center px-6" data-home-animate>
          <div className="w-full rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center shadow-sm backdrop-blur-sm">
            <h2 className="text-2xl font-semibold tracking-tight">首页还没有视频</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              数据库清空后会显示这个空态。上传或创建第一条视频后，这里会自动恢复为视频流。
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="mt-4 grid gap-4 px-18"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {videos.map((v, i) => (
            <div key={v.id ?? `video-${i}`} data-home-animate data-gallery-card>
              <VideoCard data={v} />
            </div>
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="h-12 w-full flex items-center justify-center mt-12">
        {isLoadingMore && <p className="text-sm text-muted-foreground">Loading...</p>}
      </div>
    </div>
  )
}
