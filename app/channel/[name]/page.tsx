import { ChannelPageIntro } from "@/components/channel/channel-page-intro";
import { VideoGridSection } from "@/components/home/video-grid-section";
import { HomeNavbar } from "@/components/home/home-navbar";
import { ChannelInfo } from "@/components/player/channel-info";
import { PageReadySignal } from "@/components/transition/page-ready-signal";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getChannelPageData } from "@/lib/server/channels";

function formatCompactNumber(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return `${value}`;
}

function formatJoinDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(value);
}

export default async function ChannelPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const { channel, videos } = await getChannelPageData(name);

  return (
    <div className="mx-auto min-h-screen w-full">
      <HomeNavbar />
      <main className="w-full px-[5%] py-6">
        <ChannelPageIntro>
          <section data-channel-animate>
            <Card className="gap-0 overflow-hidden rounded-[2rem] border-border/70 py-0 shadow-none">
              <div
                className="relative min-h-44 border-b border-border/70 bg-gradient-to-br from-muted via-background to-secondary/70 sm:min-h-56"
                style={
                  channel.banner
                    ? {
                        backgroundImage: `linear-gradient(to bottom right, hsl(var(--muted) / 0.75), hsl(var(--background) / 0.45)), url("${channel.banner}")`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              />

              <CardContent className="px-5 py-6 sm:px-8">
                <div className="flex flex-col gap-6">
                  <ChannelInfo
                    channelId={channel.id}
                    name={channel.name}
                    image={channel.owner.image}
                    subscribersCount={channel.subscribersCount}
                    initialIsSubscribed={channel.isSubscribed}
                    isOwner={channel.isOwner}
                    size="hero"
                  />

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">创作者：{channel.owner.name}</Badge>
                    <Badge variant="outline">{formatCompactNumber(channel.publicVideosCount)} 个公开视频</Badge>
                    <Badge variant="outline">{formatCompactNumber(channel.totalViews)} 次观看</Badge>
                    <Badge variant="outline">加入于 {formatJoinDate(channel.createdAt)}</Badge>
                  </div>

                  <div className="max-w-4xl space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                      {channel.owner.name} 的频道
                    </h1>
                    <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                      {channel.description || "这个频道正在整理中，稍后会带来更多内容。"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="mt-8" data-channel-animate>
            {videos.length > 0 ? (
              <div data-channel-animate>
                <VideoGridSection
                  title="最新视频"
                  description=""
                  videos={videos}
                  emptyState={null}
                />
              </div>
            ) : (
              <Card className="mt-6 gap-0 rounded-3xl border-dashed py-0 shadow-none">
                <CardHeader>
                  <CardTitle>还没有可展示的视频</CardTitle>
                  <CardDescription>
                    {channel.isOwner
                      ? "等发布第一条公开视频后，这里就会像首页一样铺开展示。"
                      : "这个频道暂时还没有公开视频。"}
                  </CardDescription>
                </CardHeader>
              </Card>
            )}
          </section>
        </ChannelPageIntro>
      </main>
      <PageReadySignal />
    </div>
  );
}
