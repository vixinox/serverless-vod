import { notFound } from "next/navigation";
import { getVideoAnalyticsPageData } from "@/lib/server/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import { VideoEngagementChart, VideoViewsTrendChart } from "@/components/studio/analytics/charts";
import { VideoDailyDetailExplorer } from "@/components/studio/analytics/video-daily-detail-explorer";
import {
  formatCompactNumber,
  formatDecimalPercent,
  formatDurationSeconds,
  formatSignedPercent,
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
          title="播放量"
          value={formatCompactNumber(analytics.overview30d.views)}
          hint={formatSignedPercent(analytics.comparison.views7d.changePercent)}
        />
        <StudioMetricCard
          title="观看时长"
          value={formatDurationSeconds(analytics.overview30d.averageViewSeconds)}
          hint={`${analytics.overview30d.watchTimeHours.toFixed(1)} 小时`}
        />
        <StudioMetricCard
          title="观众反馈"
          value={formatDecimalPercent(analytics.overview30d.positiveRate)}
          hint={`${analytics.overview30d.likesGained} 赞 / ${analytics.overview30d.dislikesGained} 踩`}
        />
        <StudioMetricCard
          title="讨论热度"
          value={analytics.overview30d.commentsGained.toLocaleString("zh-CN")}
          hint={`${analytics.overview30d.commentsPerThousandViews.toFixed(2).replace(".00", "")}/千次播放`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {analytics.diagnostics.map((item) => (
          <Card key={item.title} className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">{item.title}</span>
                <Badge
                  variant={item.tone === "down" ? "destructive" : item.tone === "neutral" ? "outline" : "secondary"}
                  className="rounded-full px-2.5 py-1"
                >
                  {item.value}
                </Badge>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <VideoViewsTrendChart
        data={analytics.trend30d.map((item) => ({
          date: item.date.toISOString(),
          views: item.views,
          uniqueViewers: item.uniqueViewers,
          watchTimeHours: item.watchTimeHours,
          averageViewSeconds: item.averageViewSeconds,
          completionRate: item.completionRate,
          engagementRate: item.engagementRate,
          feedbackRate: item.feedbackRate,
          positiveRate: item.positiveRate,
          likesGained: item.likesGained,
          dislikesGained: item.dislikesGained,
          reactionsGained: item.reactionsGained,
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
            averageViewSeconds: item.averageViewSeconds,
            completionRate: item.completionRate,
            engagementRate: item.engagementRate,
            feedbackRate: item.feedbackRate,
            positiveRate: item.positiveRate,
            likesGained: item.likesGained,
            dislikesGained: item.dislikesGained,
            reactionsGained: item.reactionsGained,
            commentsGained: item.commentsGained,
          }))}
        />

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm pt-0">
          <CardHeader className="border-b border-border/70 bg-background/40 pt-6">
            <CardTitle>累计反馈</CardTitle>
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
                {`${analytics.overview30d.reactionsGained + analytics.overview30d.commentsGained} 次`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {`${analytics.overview30d.likesGained} 赞 / ${analytics.overview30d.dislikesGained} 踩 / ${analytics.overview30d.commentsGained} 评论`}
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
          dislikesGained: item.dislikesGained,
          commentsGained: item.commentsGained,
        }))}
      />
    </div>
  );
}
