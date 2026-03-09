'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoCard } from "./video-card";
import { getVideos, type VideoData } from "@/actions/video/get-videos";

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

  const [videos, setVideos] = useState<(VideoData | undefined)[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isInitialLoaded, setIsInitialLoaded] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { items, nextCursor } = await getVideos();
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

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;

    setIsLoadingMore(true);
    try {
      const { items, nextCursor } = await getVideos({ cursor });

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

  return (
    <div className="w-full">
      <div className="grid px-2 gap-4 mt-4"
           style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {videos.map((v, i) => (
          <VideoCard key={`video-${i}`} data={v}/>
        ))}
      </div>

      <div ref={loadMoreRef} className="h-12 w-full flex items-center justify-center mt-12">
        {isLoadingMore && <p className="text-sm text-muted-foreground">Loading...</p>}
      </div>
    </div>
  )
}