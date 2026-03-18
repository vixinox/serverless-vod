import { Sparkles } from "lucide-react";
import { getRecommendation } from "@/actions/video/get-recommend-videos";
import { RecommendVideo } from "@/components/player/recommend-video";

export async function RecommendationList({
  shortCode,
  excludeShortCodes = [],
}: {
  shortCode: string;
  excludeShortCodes?: string[];
}) {
  const excluded = Array.from(new Set([shortCode, ...excludeShortCodes]));
  const recommendVideos = await getRecommendation(12, excluded);

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
