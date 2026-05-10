import { getStatPageData } from "@/lib/server/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import {
  ContributionDistributionChart,
  PublishPaceChart,
  SubscriberFlowChart,
  TrendMetricChart,
} from "@/components/studio/analytics/charts";
import { VideoLeaderboardTable } from "@/components/studio/analytics/video-leaderboard-table";
import {
  formatCompactNumber,
  formatDurationSeconds,
  formatHoursLabel,
  formatSignedPercent,
  formatSignedNumber,
} from "@/components/studio/analytics/utils";

export default async function StatPage() {
  const stats = await getStatPageData();

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      {!stats.hasChannel || !stats.channel ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>暂无频道数据</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StudioMetricCard
              title="播放量"
              value={formatCompactNumber(stats.overview30d.views)}
              hint={formatSignedPercent(stats.comparison30d.views.changePercent)}
            />
            <StudioMetricCard
              title="观看时长"
              value={formatHoursLabel(stats.overview30d.watchTimeHours)}
              hint={`平均 ${formatDurationSeconds(stats.overview30d.averageViewSeconds)}`}
            />
            <StudioMetricCard
              title="订阅变化"
              value={formatSignedNumber(stats.overview30d.subscribersNet)}
              hint="近 30 天净增"
            />
            <StudioMetricCard
              title="30 天发布"
              value={formatCompactNumber(stats.overview30d.videosPublished)}
              hint={`日均 ${(stats.overview30d.videosPublished / 30).toFixed(1).replace(".0", "")} 条`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <TrendMetricChart
              data={stats.trend30d.map((item) => ({
                date: item.date.toISOString(),
                views: item.views,
                watchTimeHours: item.watchTimeHours,
                averageViewSeconds: item.averageViewSeconds,
                rollingViews7d: item.rollingViews7d,
                subscriberPerThousandViews: item.subscriberPerThousandViews,
                subscribersNet: item.subscribersNet,
                subscribersGained: item.subscribersGained,
                subscribersLost: item.subscribersLost,
              }))}
            />
            <PublishPaceChart
              data={stats.trend30d.map((item) => ({
                date: item.date.toISOString(),
                videosPublished: item.videosPublished,
              }))}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <SubscriberFlowChart
              data={stats.subscriberFlow30d.map((item) => ({
                date: item.date.toISOString(),
                views: item.views,
                watchTimeHours: item.watchTimeHours,
                averageViewSeconds: item.averageViewSeconds,
                rollingViews7d: item.rollingViews7d,
                subscriberPerThousandViews: item.subscriberPerThousandViews,
                subscribersNet: item.subscribersNet,
                subscribersGained: item.subscribersGained,
                subscribersLost: item.subscribersLost,
              }))}
            />
            <ContributionDistributionChart
              data={stats.videoLeaderboard30d.map((item) => ({
                id: item.id,
                title: item.title,
                shortCode: item.shortCode,
                viewsLastDays: item.viewsLastDays,
                contributionPercent: item.contributionPercent,
              }))}
            />
          </div>

          <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm pt-0">
            <CardHeader className="border-b border-border/70 bg-background/40 pt-6">
              <CardTitle>增长贡献榜</CardTitle>
            </CardHeader>
            <CardContent>
              <VideoLeaderboardTable rows={stats.videoLeaderboard30d} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
