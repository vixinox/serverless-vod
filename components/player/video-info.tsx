import { Skeleton } from "@/components/ui/skeleton";
import { VideoDescriptionCard } from "@/components/player/video-description-card";
import type { ChannelInfoData as ChannelData, VideoInfoData as VideoData } from "@/lib/server/videos";
import { VideoActionButtons } from "@/components/player/video-action-buttons";
import { ChannelInfo } from "@/components/player/channel-info";

export function VideoInfo({ videoData, channelData, isOwner }: {
  videoData?: VideoData | null;
  channelData?: ChannelData | null;
  isOwner?: boolean;
}) {
  const isLoading = !videoData || !channelData;

  if (isLoading) {
    return <VideoInfoSkeleton />;
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <h1 className="text-xl font-bold">{videoData.title}</h1>

      <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <ChannelInfo
          channelId={channelData.id}
          name={channelData.name}
          image={channelData.owner.image}
          subscribersCount={channelData.subscribersCount}
          initialIsSubscribed={channelData.isSubscribed}
          isOwner={Boolean(isOwner)}
          href={`/channel/${encodeURIComponent(channelData.name)}`}
        />

        <VideoActionButtons
          shortCode={videoData.shortCode}
          likesCount={videoData.likesCount}
          prevReaction={videoData.prevReaction}
          isSaved={videoData.isSaved}
        />
      </div>

      <VideoDescriptionCard
        description={videoData.description}
        views={videoData.views}
        createdAt={videoData.createdAt}
      />
    </div>
  );
}

function VideoInfoSkeleton() {
  return (
    <div className="w-full flex flex-col gap-2 animate-pulse">
      <Skeleton className="h-6 w-[60%] rounded-md" />

      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-3 w-16 rounded-md mt-1" />
          </div>
          <Skeleton className="h-8 w-16 rounded-full ml-6" />
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
      </div>

      <div className="mt-2">
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}
