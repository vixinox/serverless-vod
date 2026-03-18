import type { ReactNode } from "react";
import { getWatchSidebarData } from "@/actions/video/get-watch-sidebar-data";
import { getVideoInfo } from "@/actions/video/get-video-info";
import { CommentArea } from "@/components/comment/comment-area";
import { PlaylistPanel } from "@/components/player/playlist-panel";
import { VideoPlayer } from "@/components/player/video-player";
import { RecommendationList } from "@/components/player/recommendation-list";
import { VideoInfo } from "@/components/player/video-info";
import { PageReadySignal } from "@/components/transition/page-ready-signal";
import { PLAYER_COL_CLASSES } from "@/lib/layout-config";
import { cn } from "@/lib/utils";
import { EyeOff, Link2, FileText, Loader2 } from "lucide-react";

const VISIBILITY_BANNER: Record<string, { icon: ReactNode; text: string; className: string }> = {
  PRIVATE: {
    icon: <EyeOff className="w-4 h-4" />,
    text: "私享视频 — 仅您可见",
    className: "bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400",
  },
  DRAFT: {
    icon: <FileText className="w-4 h-4" />,
    text: "草稿 — 仅您可见",
    className: "bg-zinc-500/10 border border-zinc-500/30 text-zinc-500 dark:text-zinc-400",
  },
  UNLISTED: {
    icon: <Link2 className="w-4 h-4" />,
    text: "不公开视频 — 任何有链接的人均可通过此链接访问",
    className: "bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400",
  },
};

export default async function VideoPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const [{ videoData, channelData, isOwner }, sidebarData] = await Promise.all([
    getVideoInfo(shortCode),
    getWatchSidebarData(shortCode),
  ]);
  const cloudfrontDomain = process.env.VIDEO_CLOUDFRONT_DOMAIN ?? "";
  const playlist = sidebarData.playlist;

  const playbackUrl = cloudfrontDomain.trim()
    ? `https://${cloudfrontDomain.trim()}/${shortCode}/master.m3u8`
    : `/api/hls/${encodeURIComponent(shortCode)}/master.m3u8`;

  const visibilityBanner = isOwner && videoData.visibility !== "PUBLIC"
    ? VISIBILITY_BANNER[videoData.visibility]
    : null;

  const isProcessing = isOwner && videoData.processingStatus !== "READY";

  return (
    <div className="flex-1 w-screen h-full bg-background px-[5%]">
      {visibilityBanner && (
        <div className={`flex items-center gap-2 mt-4 px-4 py-2 rounded-md text-sm font-medium w-fit ${visibilityBanner.className}`}>
          {visibilityBanner.icon}
          <span>{visibilityBanner.text}</span>
        </div>
      )}
      {isProcessing && (
        <div className="flex items-center gap-2 mt-4 px-4 py-2 rounded-md text-sm font-medium bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>视频仍在处理中（{videoData.processingStatus}），处理完成后将向符合权限的用户开放</span>
        </div>
      )}
      <div className="mt-4 flex h-full w-full flex-col gap-6 sm:flex-row xl:gap-4">
        <div className={cn(PLAYER_COL_CLASSES, !playlist && "xl:w-full 2xl:w-full xl:pr-0")}>
          <VideoPlayer videoId={videoData.id} src={playbackUrl} thumbnail={videoData.thumbnail} />
          <VideoInfo videoData={videoData} channelData={channelData} isOwner={isOwner} />
          <CommentArea shortCode={shortCode}/>
        </div>
        <div className="w-full space-y-4 xl:w-[25%] 2xl:w-[19%]">
          {playlist ? <PlaylistPanel shortCode={shortCode} playlist={playlist} /> : null}
          <RecommendationList shortCode={shortCode} excludeShortCodes={[shortCode]} />
        </div>
      </div>
      <PageReadySignal />
    </div>
  )
}
