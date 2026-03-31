import { getStatPageData } from "@/lib/server/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import { AnalyticsHero, AnalyticsPageShell, AnalyticsSection } from "@/components/studio/analytics/page-shell";
import { SubscriberFlowChart, TrendMetricChart, VideoTypeDonutChart } from "@/components/studio/analytics/charts";
import { VideoLeaderboardTable } from "@/components/studio/analytics/video-leaderboard-table";
import {
  formatCompactNumber,
  formatHoursLabel,
} from "@/components/studio/analytics/utils";

export default async function StatPage() {
  const stats = await getStatPageData();

  return (
    <AnalyticsPageShell>
      {!stats.hasChannel || !stats.channel ? (
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>暂无频道数据</CardTitle>
            <CardDescription>当频道创建并开始累积统计后，这里会展示趋势分析和视频表现。</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <AnalyticsHero
            eyebrow="Channel Analytics"
            title="数据分析"
            description={`围绕 ${stats.channel.name} 的最近 30 天表现，查看趋势变化、订阅波动与视频贡献。`}
            badges={
              <>
                <Badge variant="outline" className="rounded-full px-3 py-1">最近 30 天</Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1">频道级视角</Badge>
              </>
            }
            stats={[
              { label: "30 天观看", value: formatCompactNumber(stats.overview30d.views) },
              { label: "观看时长", value: formatHoursLabel(stats.overview30d.watchTimeHours) },
              { label: "净增订阅", value: stats.overview30d.subscribersNet.toLocaleString("zh-CN") },
              { label: "发布视频", value: stats.overview30d.videosPublished.toLocaleString("zh-CN") },
            ]}
          />

          <AnalyticsSection
            kicker="Overview"
            title="核心指标"
            description="先看最能反映频道状态的四个指标，再下钻到趋势和单视频表现。"
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StudioMetricCard
              title="30 天观看次数"
              value={formatCompactNumber(stats.overview30d.views)}
              hint="来自频道日统计的累计播放"
              accent="var(--chart-1)"
            />
            <StudioMetricCard
              title="30 天观看时长"
              value={formatHoursLabel(stats.overview30d.watchTimeHours)}
              hint="已换算为小时，便于复盘"
              accent="var(--chart-2)"
            />
            <StudioMetricCard
              title="30 天净增订阅"
              value={stats.overview30d.subscribersNet.toLocaleString("zh-CN")}
              hint="新增订阅减去流失订阅"
              accent="var(--chart-3)"
            />
            <StudioMetricCard
              title="30 天发布视频数"
              value={stats.overview30d.videosPublished.toLocaleString("zh-CN")}
              hint="统计窗口内发布的视频数量"
              accent="var(--chart-5)"
            />
          </div>

          <AnalyticsSection
            kicker="Trends"
            title="趋势与结构"
            description="把播放、订阅和内容结构放在一起看，更容易识别真正的增长来源。"
          />

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
              description="按频道内现有视频数量查看长短内容的结构占比。"
            />
          </div>

          <AnalyticsSection
            kicker="Leaderboard"
            title="视频表现"
            description="默认按近 30 天观看次数排序，快速定位频道里的主要流量来源。"
            aside={
              <Badge variant="outline" className="rounded-full px-3 py-1">
                {`${stats.videoLeaderboard30d.length} 条内容`}
              </Badge>
            }
          />

          <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm">
            <CardHeader className="border-b border-border/70 bg-background/40">
              <CardTitle>视频表现</CardTitle>
              <CardDescription>频道级榜单与分析入口都收口在这里，便于继续下钻到单视频分析。</CardDescription>
            </CardHeader>
            <CardContent>
              <VideoLeaderboardTable rows={stats.videoLeaderboard30d} />
            </CardContent>
          </Card>
        </>
      )}
    </AnalyticsPageShell>
  );
}
