"use client"

import { Sparkles } from "lucide-react";
import { RecommendVideo } from "@/components/player/recommend-video";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import type { RecommendationVideoData as VideoData } from "@/lib/server/videos";

export function RecommendationList() {
  const shortCode = usePathname().split("/watch/")[1];
  const [recommendVideos, setRecommendVideos] = useState<VideoData[]>([]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const excluded = shortCode ? Array.from(new Set([shortCode])) : [];
        const videos = await apiRequest<VideoData[]>(
          `/api/videos/recommendations?limit=12&exclude=${encodeURIComponent(excluded.join(","))}`
        );
        setRecommendVideos(videos);
      } catch {
        setRecommendVideos([]);
      }
    };

    void fetchRecommendations();
  }, [shortCode]);

  return (
    <div className="w-full space-y-3">
      <div className="px-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-primary" />
          <span>接着看</span>
        </div>
      </div>

      {recommendVideos.length > 0 ? (
        recommendVideos.map((video) => (
          <RecommendVideo key={video.id} data={video} />
        ))
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          暂时没有更多推荐视频可展示。
        </div>
      )}
    </div>
  );
}
