import { VideoGridSection } from "@/components/home/video-grid-section";
import { getSavedVideos } from "@/lib/server/playlists";
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

export default async function SavedPage() {
  const videos = await getSavedVideos();

  return (
    <BrowseShell>
      <div data-home-animate>
        <VideoGridSection
          title="收藏夹"
          description="这里展示你通过播放器快速收藏的“稍后再看”视频。"
          videos={videos}
          emptyState="还没有收藏内容，去播放器点一下“稍后再看”吧。"
          renderExtra={(video) => (
            <p className="px-1 text-xs text-muted-foreground">
              收藏时间：{formatDateTime(video.savedAt)}
            </p>
          )}
        />
      </div>
    </BrowseShell>
  );
}
