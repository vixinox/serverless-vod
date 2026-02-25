import { getVideoInfo } from "@/actions/video/get-video-info";
import { CommentArea } from "@/components/comment/comment-area";
import { VideoPlayer } from "@/components/player/video-player";
import { RecommendationList } from "@/components/player/recommendation-list";
import { VideoInfo } from "@/components/player/video-info";

export default async function VideoPage({ params }: { params: Promise<{ shortCode: string }> }) {
  const { shortCode } = await params;
  const { videoData, channelData } = await getVideoInfo(shortCode);
  const cloudfrontDomain = process.env.VIDEO_CLOUDFRONT_DOMAIN ?? "";
  const localstackEndpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
  const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";

  const playbackUrl = cloudfrontDomain.trim()
    ? `https://${cloudfrontDomain.trim()}/${shortCode}/master.m3u8`
    : `${localstackEndpoint.replace(/\/$/, "")}/${hlsBucket}/${shortCode}/master.m3u8`;

  return (
    <div className="flex-1 px-6 bg-background">
      <div className="flex h-full w-full mt-6">
        <div className="bg-background flex flex-col gap-6 w-[70%] lg:w-[75%] xl:w-[81%] pr-4">
          <VideoPlayer src={playbackUrl} thumbnail={videoData.thumbnail} />
          <VideoInfo videoData={videoData} channelData={channelData}/>
          <CommentArea shortCode={shortCode}/>
        </div>
        {/* <RecommendationList/> */}
      </div>
    </div>
  )
}
