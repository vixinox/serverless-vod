import { getHistoryVideos } from "@/actions/video/get-history-videos";
import { VideoCard } from "@/components/home/video-card";
import { HomeNavbar } from "@/components/home/home-navbar";
import { PageReadySignal } from "@/components/transition/page-ready-signal";

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
    <div className="mx-auto min-h-screen w-full">
      <HomeNavbar />
      <main className="w-full px-[5%] py-6">
        <div className="space-y-2 px-2">
          <h1 className="text-2xl font-bold">观看历史</h1>
          <p className="text-sm text-muted-foreground">
            最近播放过的视频会显示在这里。
          </p>
        </div>

        {videos.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 px-2 mt-6 md:grid-cols-2 2xl:grid-cols-3">
            {videos.map((video) => (
              <div key={video.id} className="space-y-2">
                <VideoCard data={video} />
                <p className="px-1 text-xs text-muted-foreground">
                  上次观看：{formatDateTime(video.lastWatchedAt)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-2 mt-8 text-sm text-muted-foreground">
            还没有历史记录，先去看点视频吧。
          </div>
        )}
      </main>
      <PageReadySignal />
    </div>
  );
}
