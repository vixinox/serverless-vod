import type { ReactNode } from "react";
import { VideoCard } from "@/components/home/video-card";
import type { GalleryVideoData } from "@/lib/server/videos";

type VideoGridItem = GalleryVideoData;

interface VideoGridSectionProps<T extends VideoGridItem> {
  title: string;
  description: string;
  videos: T[];
  emptyState: ReactNode;
  renderExtra?: (video: T) => ReactNode;
}

export function VideoGridSection<T extends VideoGridItem>({
  title,
  description,
  videos,
  emptyState,
  renderExtra,
}: VideoGridSectionProps<T>) {
  return (
    <>
      <div className="space-y-2 px-2" data-home-animate>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {videos.length > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-4 px-2 md:grid-cols-2 2xl:grid-cols-3" data-home-animate>
          {videos.map((video) => (
            <div key={video.id} className={renderExtra ? "space-y-2" : undefined} data-home-animate>
              <VideoCard data={video} />
              {renderExtra ? renderExtra(video) : null}
            </div>
          ))}
        </div>
      ) : emptyState ? (
        <div className="mt-8 px-2 text-sm text-muted-foreground" data-home-animate>{emptyState}</div>
      ) : null}
    </>
  );
}
