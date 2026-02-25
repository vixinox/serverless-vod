'use client'

import { useCallback, useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { VideoCard } from "./video-card";
import { ShortVideoCard } from "./short-video-card";
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
  const colsNormal = useResponsiveCols([
    { width: 0, cols: 1 },
    { width: 1080, cols: 2 },
    { width: 1440, cols: 3 },
    { width: 2560, cols: 4 }
  ]);
  const colsShort = useResponsiveCols([
    { width: 0, cols: 2 },
    { width: 1080, cols: 3 },
    { width: 1440, cols: 5 },
    { width: 2560, cols: 6 }
  ]);

  const [videos, setVideos] = useState<(VideoData | undefined)[]>(() =>
    new Array(12).fill(undefined)
  );
  const [shorts, setShorts] = useState<(VideoData | undefined)[]>(() =>
    new Array(12).fill(undefined)
  );
  const [longCursor, setLongCursor] = useState<string | null | undefined>(undefined);
  const [shortCursor, setShortCursor] = useState<string | null | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { long, short, nextLongCursor, nextShortCursor } = await getVideos();
        setVideos(long);
        setShorts(short);
        setLongCursor(nextLongCursor);
        setShortCursor(nextShortCursor);
      } catch (error) {
        console.error("Failed to load videos", error);
      }
    })()
  }, []);

  const canLoadMore = longCursor !== null;

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;

    setIsLoadingMore(true);
    try {
      const { long, short, nextLongCursor, nextShortCursor } = await getVideos({
        longCursor,
        shortCursor: null
      });

      if (long.length > 0) {
        setVideos(prev => [...prev, ...long]);
      }

      setLongCursor(nextLongCursor);
      setShortCursor(nextShortCursor);
    } catch (error) {
      console.error("Failed to load more videos", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [canLoadMore, isLoadingMore, longCursor, shortCursor]);

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

  const firstNormalRow = videos.slice(0, colsNormal);
  const thirdNormalRow = videos.slice(colsNormal, colsNormal * 2);
  const remainingNormal = videos.slice(colsNormal * 2);
  const firstShortRow = shorts.slice(0, colsShort);
  const secondShortRow = shorts.slice(colsShort, colsShort * 2);

  return (
    <div className="w-full">
      <div className="grid mt-10 px-2 gap-4"
           style={{ gridTemplateColumns: `repeat(${colsNormal}, 1fr)` }}
      >
        {firstNormalRow.map((v, i) => (
          <VideoCard key={`normal-first-${i}`} data={v}/>
        ))}
      </div>

      <div className="w-full flex pl-4 mt-16 items-center">
        <Smartphone className="text-red-500"/>
        <p className="font-bold text-xl ml-2">Shorts</p>
      </div>

      <div className="grid mt-10 px-2 gap-4"
           style={{ gridTemplateColumns: `repeat(${colsShort}, 1fr)` }}
      >
        {firstShortRow.map((v, i) => (
          <ShortVideoCard key={`short-first-${i}`} data={v}/>
        ))}
      </div>

      <div className="grid mt-16 px-2 gap-4"
           style={{ gridTemplateColumns: `repeat(${colsNormal}, 1fr)` }}
      >
        {thirdNormalRow.map((v, i) => (
          <VideoCard key={`normal-second-${i}`} data={v}/>
        ))}
      </div>

      <div className="w-full flex pl-4 mt-16 items-center">
        <Smartphone className="text-red-500"/>
        <p className="font-bold text-xl ml-2">Shorts</p>
      </div>

      <div className="grid mt-16 px-2 gap-4"
           style={{ gridTemplateColumns: `repeat(${colsShort}, 1fr)` }}
      >
        {secondShortRow.map((v, i) => (
          <ShortVideoCard key={`short-second-${i}`} data={v}/>
        ))}
      </div>

      {remainingNormal.length > 0 && (
        <div className="grid mt-16 px-2 gap-4"
             style={{ gridTemplateColumns: `repeat(${colsNormal}, 1fr)` }}
        >
          {remainingNormal.map((v, i) => (
            <VideoCard key={`normal-remaining-${i}`} data={v}/>
          ))}
        </div>
      )}

      <div ref={loadMoreRef} className="h-12 w-full flex items-center justify-center mt-12">
        {isLoadingMore && <p className="text-sm text-muted-foreground">Loading...</p>}
      </div>
    </div>
  )
}