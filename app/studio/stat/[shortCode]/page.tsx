import { notFound } from "next/navigation";
import { getVideoAnalyticsPageData } from "@/lib/server/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import { VideoEngagementChart, VideoViewsTrendChart } from "@/components/studio/analytics/charts";
import { VideoDailyDetailExplorer } from "@/components/studio/analytics/video-daily-detail-explorer";
import {
  formatCompactNumber,
  formatHoursLabel,
} from "@/components/studio/analytics/utils";

export default async function VideoAnalyticsPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  const analytics = await getVideoAnalyticsPageData(shortCode);

  if (!analytics.hasVideo || !analytics.video) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StudioMetricCard
          title="累计观看"
          value={formatCompactNumber(analytics.video.viewsTotal)}
        />
        <StudioMetricCard
          title="30 天观看"
          value={formatCompactNumber(analytics.overview30d.views)}
        />
        <StudioMetricCard
          title="30 天独立观众"
          value={formatCompactNumber(analytics.overview30d.uniqueViewers)}
        />
        <StudioMetricCard
          title="30 天观看时长"
          value={formatHoursLabel(analytics.overview30d.watchTimeHours)}
        />
      </div>

      <VideoViewsTrendChart
        data={analytics.trend30d.map((item) => ({
          date: item.date.toISOString(),
          views: item.views,
          uniqueViewers: item.uniqueViewers,
          watchTimeHours: item.watchTimeHours,
          likesGained: item.likesGained,
          commentsGained: item.commentsGained,
        }))}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <VideoEngagementChart
          data={analytics.trend30d.map((item) => ({
            date: item.date.toISOString(),
            views: item.views,
            uniqueViewers: item.uniqueViewers,
            watchTimeHours: item.watchTimeHours,
            likesGained: item.likesGained,
            commentsGained: item.commentsGained,
          }))}
        />

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm pt-0">
          <CardHeader className="border-b border-border/70 bg-background/40 pt-6">
            <CardTitle>视频摘要</CardTitle>
            <CardDescription>累计数据一览</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-sm">
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-muted-foreground">累计点赞</p>
              <p className="mt-1 text-xl font-semibold">{analytics.video.likesCount.toLocaleString("zh-CN")}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-muted-foreground">累计评论</p>
              <p className="mt-1 text-xl font-semibold">{analytics.video.commentsCount.toLocaleString("zh-CN")}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
              <p className="text-muted-foreground">近 30 天互动</p>
              <p className="mt-1 text-xl font-semibold">
                {`${analytics.overview30d.likesGained + analytics.overview30d.commentsGained} 次`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {`${analytics.overview30d.likesGained} 新赞 / ${analytics.overview30d.commentsGained} 新评论`}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <VideoDailyDetailExplorer
        data={analytics.trend30d.map((item) => ({
          date: item.date.toISOString(),
          views: item.views,
          uniqueViewers: item.uniqueViewers,
          watchTimeHours: item.watchTimeHours,
          likesGained: item.likesGained,
          commentsGained: item.commentsGained,
        }))}
      />
    </div>
  );
}
