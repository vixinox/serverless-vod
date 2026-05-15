import { getHistoryVideos } from "@/lib/server/videos";
import { VideoTimeline } from "@/components/home/video-timeline";
import { BrowseShell } from "@/components/home/browse-shell";

export default async function HistoryPage() {
  const videos = await getHistoryVideos();

  return (
    <BrowseShell>
      <VideoTimeline
        title="观看历史"
        videos={videos.map((video) => ({
          ...video,
          timelineAt: video.lastWatchedAt,
        }))}
        variant="history"
        emptyState="还没有历史记录，先去看点视频吧。"
      />
    </BrowseShell>
  );
}
