import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ReactNode } from "react";
import { VideoDescriptionCard } from "@/components/player/video-description-card";
import { ChannelData, VideoData } from "@/actions/video/get-video-info";
import { VideoActionButtons } from "@/components/player/video-action-buttons";

interface UploaderInfoProps {
  name?: string;
  image?: string | null;
  subscribersCount?: number;
  children?: ReactNode;
}

export function VideoInfo({ videoData, channelData }: {
  videoData?: VideoData | null;
  channelData?: ChannelData | null;
}) {
  const isLoading = !videoData || !channelData;

  if (isLoading) {
    return <VideoInfoSkeleton/>;
  }

  return (
    <div className="w-full flex flex-col gap-2">
      <h1 className="text-xl font-bold">{videoData.title}</h1>

      <div className="w-full flex justify-between">
        <UploaderInfo
          name={channelData.name}
          image={channelData.owner.image}
          subscribersCount={channelData.subscribersCount}
        >
          <Button className="rounded-full cursor-pointer ml-6">订阅</Button>
        </UploaderInfo>

        <VideoActionButtons videoId={videoData.id} likesCount={videoData.likesCount}
                            prevReaction={videoData.prevReaction}/>
      </div>

      <VideoDescriptionCard
        description={videoData.description}
        views={videoData.views}
        createdAt={videoData.createdAt}
      >
        <UploaderInfo
          name={channelData.owner.name}
          image={channelData.owner.image}
          subscribersCount={channelData.subscribersCount}
        />
      </VideoDescriptionCard>
    </div>
  );
}

function VideoInfoSkeleton() {
  return (
    <div className="w-full flex flex-col gap-2 animate-pulse">
      <Skeleton className="h-6 w-[60%] rounded-md"/>

      <div className="w-full flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full"/>
          <div>
            <Skeleton className="h-4 w-24 rounded-md"/>
            <Skeleton className="h-3 w-16 rounded-md mt-1"/>
          </div>
          <Skeleton className="h-8 w-16 rounded-full ml-6"/>
        </div>

        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-full"/>
          <Skeleton className="h-8 w-20 rounded-full"/>
          <Skeleton className="h-8 w-20 rounded-full"/>
          <Skeleton className="h-8 w-20 rounded-full"/>
        </div>
      </div>

      <div className="mt-2">
        <Skeleton className="h-20 w-full rounded-md"/>
      </div>
    </div>
  );
}

const UploaderInfo = ({ name, image, subscribersCount, children }: UploaderInfoProps) => {
  if (!name) {
    return (
      <div className="flex items-center gap-3 animate-pulse">
        <Skeleton className="h-10 w-10 rounded-full"/>
        <div>
          <Skeleton className="h-4 w-24 rounded-md"/>
          <Skeleton className="h-3 w-16 rounded-md mt-1"/>
        </div>
        <Skeleton className="h-8 w-16 rounded-full ml-6"/>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarImage src={image ?? undefined}/>
        <AvatarFallback className="bg-[#33691e] text-lg">{name?.charAt(0) ?? "U"}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-bold">{name}</p>
        <p className="text-xs text-muted-foreground">
          {`${subscribersCount}位订阅者`}
        </p>
      </div>
      {children}
    </div>
  );
};