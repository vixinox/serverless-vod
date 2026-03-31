import { getVideoDetails } from "@/lib/server/videos";
import { VideoForm } from "@/components/studio/video/video-form";
import { PageReadySignal } from "@/components/transition/page-ready-signal";

export default async function VideoEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = await getVideoDetails(id);

  return (
    <>
      <PageReadySignal />
      <VideoForm
        imageDomain={video.imageDomain}
        video={{
          title: video.title,
          description: video.description ?? undefined,
          thumbnail: video.thumbnail ?? undefined,
          visibility: video.visibility,
          shortCode: video.shortCode,
          qualityPresets: video.qualityPresets,
          processingStatus: video.processingStatus,
          processingError: video.processingError,
        }}
      />
    </>
  );
}
