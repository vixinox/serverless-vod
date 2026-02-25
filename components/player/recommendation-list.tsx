'use client'

import { useEffect, useState } from "react";
import { RecommendVideo } from "@/components/player/recommend-video";
import { getRecommendation, VideoData } from "@/actions/video/get-recommend-videos";

export function RecommendationList() {
  const [recommendVideos, setRecommendVideos] = useState<VideoData[]>();
  useEffect(() => {
    (async () => {
      const videos = await getRecommendation();
      setRecommendVideos(videos);
    })()
  }, [])

  return (
    <div className="w-100 grow space-y-4">
      <div className="w-full p-2">
      </div>
      {recommendVideos?.map((v) => (
        <RecommendVideo key={v.id} data={v}/>
      ))}
    </div>
  );
}