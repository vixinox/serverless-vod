import { searchVideos } from "@/actions/video/search-videos";
import { VideoCard } from "@/components/home/video-card";
import { HomeNavbar } from "@/components/home/home-navbar";
import { PageReadySignal } from "@/components/transition/page-ready-signal";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const videos = query ? await searchVideos(query) : [];

  return (
    <div className="mx-auto min-h-screen w-full">
      <HomeNavbar />
      <main className="w-full px-[5%] py-6">
        <div className="space-y-2 px-2">
          <h1 className="text-2xl font-bold">搜索结果</h1>
          <p className="text-sm text-muted-foreground">
            {query ? `关键词：${query}` : "输入关键词后按回车开始搜索"}
          </p>
        </div>

        {query ? (
          videos.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 px-2 mt-6 md:grid-cols-2 2xl:grid-cols-3">
              {videos.map((video) => (
                <VideoCard key={video.id} data={video} />
              ))}
            </div>
          ) : (
            <div className="px-2 mt-8 text-sm text-muted-foreground">
              没有找到匹配的视频。
            </div>
          )
        ) : null}
      </main>
      <PageReadySignal />
    </div>
  );
}
