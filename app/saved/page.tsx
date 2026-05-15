import { VideoTimeline } from "@/components/home/video-timeline";
import { getSavedVideos, getWatchLaterVideos } from "@/lib/server/playlists";
import { BrowseShell } from "@/components/home/browse-shell";

export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list = "" } = await searchParams;
  const isWatchLater = list === "wl";
  const videos = isWatchLater
    ? await getWatchLaterVideos()
    : await getSavedVideos();

  return (
    <BrowseShell>
      <VideoTimeline
        title={isWatchLater ? "稍后再看" : "收藏夹"}
        videos={videos.map((video) => ({
          ...video,
          timelineAt: video.savedAt,
        }))}
        variant={isWatchLater ? "watch-later" : "saved"}
        emptyState={
          isWatchLater
            ? "还没有“稍后再看”内容，去播放器点一下快捷保存吧。"
            : "还没有收藏内容，去播放器点一下“收藏夹”吧。"
        }
      />
    </BrowseShell>
  );
}
