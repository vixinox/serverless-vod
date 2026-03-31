import { VideoTimeline } from "@/components/home/video-timeline";
import { getSavedVideos } from "@/lib/server/playlists";
import { BrowseShell } from "@/components/home/browse-shell";
export default async function SavedPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list = "" } = await searchParams;
  const videos = await getSavedVideos();
  const isWatchLater = list === "wl";

  return (
    <BrowseShell>
      <VideoTimeline
        title={isWatchLater ? "稍后再看" : "收藏夹"}
        description={
          isWatchLater
            ? "把想晚点处理的视频沿着时间轴排开。可以按天、周、月切换，快速回到某个加入节点。"
            : "把已经留存下来的内容按时间节点整理成一条可导航的收藏时间线，方便回看和重新筛选。"
        }
        videos={videos.map((video) => ({
          ...video,
          timelineAt: video.savedAt,
        }))}
        variant={isWatchLater ? "watch-later" : "saved"}
        timelineLabel={isWatchLater ? "加入时间" : "收藏时间"}
        emptyState={
          isWatchLater
            ? "还没有“稍后再看”内容，去播放器点一下快捷保存吧。"
            : "还没有收藏内容，去播放器点一下“稍后再看”吧。"
        }
      />
    </BrowseShell>
  );
}
