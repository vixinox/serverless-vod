import Link from "next/link";
import { notFound } from "next/navigation";
import { getVideoAnalyticsPageData } from "@/lib/server/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudioMetricCard } from "@/components/studio/analytics/metric-card";
import { AnalyticsHero, AnalyticsPageShell, AnalyticsSection } from "@/components/studio/analytics/page-shell";
import { VideoEngagementChart, VideoViewsTrendChart } from "@/components/studio/analytics/charts";
import {
  formatCompactNumber,
  formatHoursLabel,
  formatMediumDate,
  formatProcessingStatusLabel,
  formatShortDate,
  formatVideoDuration,
  formatVideoTypeLabel,
  formatVisibilityLabel,
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
    <AnalyticsPageShell>
      <AnalyticsHero
        eyebrow="Video Analytics"
        title={analytics.video.title}
        description={`${analytics.channel?.name ?? "我的频道"} · 发布于 ${formatMediumDate(
          analytics.video.publishedAt ?? analytics.video.createdAt,
        )} · 时长 ${formatVideoDuration(analytics.video.duration)}`}
        badges={
          <>
            <Badge variant="outline" className="rounded-full px-3 py-1">单视频分析</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{formatVideoTypeLabel(analytics.video.type)}</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{formatVisibilityLabel(analytics.video.visibility)}</Badge>
            <Badge variant="outline" className="rounded-full px-3 py-1">{formatProcessingStatusLabel(analytics.video.processingStatus)}</Badge>
          </>
        }
        actions={
          <>
            <Link
              href={`/studio/contents/video/${analytics.video.shortCode}`}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              编辑视频
            </Link>
            <Link
              href={`/watch/${analytics.video.shortCode}`}
              className="inline-flex items-center rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              查看播放页
            </Link>
          </>
        }
        stats={[
          { label: "累计观看", value: formatCompactNumber(analytics.video.viewsTotal) },
          { label: "30 天观看", value: formatCompactNumber(analytics.overview30d.views) },
          { label: "独立观众", value: formatCompactNumber(analytics.overview30d.uniqueViewers) },
          { label: "观看时长", value: formatHoursLabel(analytics.overview30d.watchTimeHours) },
        ]}
      />

      <AnalyticsSection
        kicker="Overview"
        title="视频核心指标"
        description="先确认这条视频最近 30 天的播放、独立观众和互动，再看趋势走势。"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StudioMetricCard
          title="累计观看"
          value={formatCompactNumber(analytics.video.viewsTotal)}
          hint="视频当前的总观看次数"
          accent="var(--chart-1)"
        />
        <StudioMetricCard
          title="30 天观看"
          value={formatCompactNumber(analytics.overview30d.views)}
          hint="最近 30 天内产生的播放"
          accent="var(--chart-2)"
        />
        <StudioMetricCard
          title="30 天独立观众"
          value={formatCompactNumber(analytics.overview30d.uniqueViewers)}
          hint="最近 30 天内的独立观众累计"
          accent="var(--chart-3)"
        />
        <StudioMetricCard
          title="30 天观看时长"
          value={formatHoursLabel(analytics.overview30d.watchTimeHours)}
          hint={`新增 ${analytics.overview30d.likesGained} 赞 · ${analytics.overview30d.commentsGained} 评论`}
          accent="var(--chart-5)"
        />
      </div>

      <AnalyticsSection
        kicker="Trends"
        title="播放与互动走势"
        description="把触达趋势和互动增量并排观察，更容易判断这条视频是继续发酵还是逐步回落。"
      />

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

        <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm">
          <CardHeader className="border-b border-border/70 bg-background/40">
            <CardTitle>视频摘要</CardTitle>
            <CardDescription>把这条视频最常看的几个指标集中放在一起。</CardDescription>
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

      <AnalyticsSection
        kicker="Daily Breakdown"
        title="逐日明细"
        description="当图表发现波峰或回落时，可以在这里快速对照到具体日期的数据变化。"
      />

      <Card className="overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm">
        <CardHeader className="border-b border-border/70 bg-background/40">
          <CardTitle>30 天日明细</CardTitle>
          <CardDescription>逐天查看这条视频的播放、独立观众和互动变化。</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>日期</TableHead>
                <TableHead>观看</TableHead>
                <TableHead>独立观众</TableHead>
                <TableHead>观看时长</TableHead>
                <TableHead>新增点赞</TableHead>
                <TableHead>新增评论</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.trend30d.slice().reverse().map((item) => (
                <TableRow key={item.date.toISOString()}>
                  <TableCell>{formatShortDate(item.date)}</TableCell>
                  <TableCell>{formatCompactNumber(item.views)}</TableCell>
                  <TableCell>{formatCompactNumber(item.uniqueViewers)}</TableCell>
                  <TableCell>{formatHoursLabel(item.watchTimeHours)}</TableCell>
                  <TableCell>{item.likesGained.toLocaleString("zh-CN")}</TableCell>
                  <TableCell>{item.commentsGained.toLocaleString("zh-CN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AnalyticsPageShell>
  );
}
