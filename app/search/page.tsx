import { searchVideos } from "@/lib/server/videos";
import { VideoGridSection } from "@/components/home/video-grid-section";
import { BrowseShell } from "@/components/home/browse-shell";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const videos = query ? await searchVideos(query) : [];

  return (
    <BrowseShell>
      <div data-home-animate>
        <VideoGridSection
          title="搜索结果"
          description={query ? `关键词：${query}` : "输入关键词后按回车开始搜索"}
          videos={query ? videos : []}
          emptyState={query ? "没有找到匹配的视频。" : ""}
        />
      </div>
    </BrowseShell>
  );
}
