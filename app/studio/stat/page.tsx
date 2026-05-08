import { getStatPageData } from "@/lib/server/stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import {
  ChannelDiagnosisStrip,
  ContentTypeRingChart,
  SubscriberFlowChart,
  TrendMetricChart,
} from "@/components/studio/analytics/charts";
import { VideoLeaderboardTable } from "@/components/studio/analytics/video-leaderboard-table";
import {
  formatCompactNumber,
  formatDurationSeconds,
  formatHoursLabel,
  formatSignedPercent,
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
              value={`${stats.overview30d.subscribersNet > 0 ? "+" : ""}${stats.overview30d.subscribersNet.toLocaleString("zh-CN")}`}
              hint="近 30 天净增"
            />
            <StudioMetricCard
              title="近期热度"
              value={stats.diagnostics.find((item) => item.title === "7 天动量")?.value ?? "暂无"}
              hint="近 7 天变化"
            />
          </div>

          <ChannelDiagnosisStrip insights={stats.diagnostics} />

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
            <ContentTypeRingChart data={stats.contentTypePerformance} />
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
            <StudioMetricCard
              title="Top3 贡献"
              value={stats.diagnostics.find((item) => item.title === "Top3 贡献")?.value ?? "暂无"}
              hint="榜单集中度"
              emphasis="soft"
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
