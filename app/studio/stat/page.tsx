import { getStatPageData } from "@/lib/server/stats";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import { SubscriberFlowChart, TrendMetricChart, VideoTypeDonutChart } from "@/components/studio/analytics/charts";
import { VideoLeaderboardTable } from "@/components/studio/analytics/video-leaderboard-table";
import {
  formatCompactNumber,
  formatHoursLabel,
} from "@/components/studio/analytics/utils";

export default async function StatPage() {
  const stats = await getStatPageData();

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      {!stats.hasChannel || !stats.channel ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>暂无频道数据</CardTitle>
            <CardDescription>当频道创建并开始累积统计后，这里会展示趋势分析和视频表现。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StudioMetricCard
              title="30 天观看次数"
              value={formatCompactNumber(stats.overview30d.views)}
            />
            <StudioMetricCard
              title="30 天观看时长"
              value={formatHoursLabel(stats.overview30d.watchTimeHours)}
            />
            <StudioMetricCard
              title="30 天净增订阅"
              value={stats.overview30d.subscribersNet.toLocaleString("zh-CN")}
            />
            <StudioMetricCard
              title="30 天发布视频数"
              value={stats.overview30d.videosPublished.toLocaleString("zh-CN")}
            />
          </div>

          <TrendMetricChart
            data={stats.trend30d.map((item) => ({
              date: item.date.toISOString(),
              views: item.views,
              watchTimeHours: item.watchTimeHours,
              subscribersNet: item.subscribersNet,
              subscribersGained: item.subscribersGained,
              subscribersLost: item.subscribersLost,
            }))}
          />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
            <SubscriberFlowChart
              data={stats.subscriberFlow30d.map((item) => ({
                date: item.date.toISOString(),
                views: item.views,
                watchTimeHours: item.watchTimeHours,
                subscribersNet: item.subscribersNet,
                subscribersGained: item.subscribersGained,
                subscribersLost: item.subscribersLost,
              }))}
            />
            <VideoTypeDonutChart
              data={stats.typeBreakdown}
              title="内容结构"
            />
          </div>

          <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm pt-0">
            <CardHeader className="border-b border-border/70 bg-background/40 pt-6">
              <CardTitle>视频表现</CardTitle>
              <CardDescription>频道级榜单与分析入口都收口在这里，便于继续下钻到单视频分析。</CardDescription>
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
