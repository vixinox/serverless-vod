import { getHistoryVideos } from "@/lib/server/videos";
import { VideoGridSection } from "@/components/home/video-grid-section";
import { BrowseShell } from "@/components/home/browse-shell";

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export default async function HistoryPage() {
  const videos = await getHistoryVideos();

  return (
    <BrowseShell>
      <div data-home-animate>
        <VideoGridSection
          title="观看历史"
          description="最近播放过的视频会显示在这里。"
          videos={videos}
          emptyState="还没有历史记录，先去看点视频吧。"
          renderExtra={(video) => (
            <p className="px-1 text-xs text-muted-foreground">
              上次观看：{formatDateTime(video.lastWatchedAt)}
            </p>
          )}
        />
      </div>
    </BrowseShell>
  );
}
