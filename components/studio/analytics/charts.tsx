"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Label, Line, LineChart, Pie, PieChart, XAxis } from "recharts";
import type { DashboardPageData, StatPageData, VideoAnalyticsPageData } from "@/lib/server/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  formatCompactNumber,
  formatHoursLabel,
  formatLongDate,
  formatPercent,
  formatShortDate,
  formatVideoTypeLabel,
} from "@/components/studio/analytics/utils";
import { cn } from "@/lib/utils";

type DashboardTrendPoint = {
  date: DashboardPageData["trend14d"][number]["date"] | string;
  views: number;
};

type VideoTypeBreakdown = DashboardPageData["typeBreakdown"];

type StatTrendPoint = {
  date: StatPageData["trend30d"][number]["date"] | string;
  views: number;
  watchTimeHours: number;
  subscribersNet: number;
  subscribersGained: number;
  subscribersLost: number;
};

type VideoTrendPoint = {
  date: VideoAnalyticsPageData["trend30d"][number]["date"] | string;
  views: number;
  uniqueViewers: number;
  watchTimeHours: number;
  likesGained: number;
  commentsGained: number;
};

type TrendMetricKey = "views" | "watchTimeHours";
type SubscriberMetricKey = "subscribersGained" | "subscribersLost";

const dashboardViewsConfig = {
  views: {
    label: "观看次数",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

const videoTypeConfig = {
  count: {
    label: "视频数",
  },
  long: {
    label: "长视频",
    color: "var(--chart-1)",
  },
  short: {
    label: "短视频",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const trendMetricConfig = {
  views: {
    label: "观看次数",
    color: "var(--chart-1)",
  },
  watchTimeHours: {
    label: "观看时长",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const subscriberMetricConfig = {
  subscribersGained: {
    label: "新增订阅",
    color: "var(--chart-2)",
  },
  subscribersLost: {
    label: "流失订阅",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const videoTrendConfig = {
  views: {
    label: "观看次数",
    color: "var(--chart-1)",
  },
  uniqueViewers: {
    label: "独立观众",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

const videoEngagementConfig = {
  likesGained: {
    label: "新增点赞",
    color: "var(--chart-3)",
  },
  commentsGained: {
    label: "新增评论",
    color: "var(--chart-5)",
  },
} satisfies ChartConfig;

const trendMetricMeta: Record<
  TrendMetricKey,
  {
    label: string;
    description: string;
    formatValue: (value: number) => string;
  }
> = {
  views: {
    label: "观看次数",
    description: "按天查看频道播放趋势",
    formatValue: formatCompactNumber,
  },
  watchTimeHours: {
    label: "观看时长",
    description: "按天查看累计观看时长",
    formatValue: formatHoursLabel,
  },
};

const subscriberMetricMeta: Record<
  SubscriberMetricKey,
  {
    label: string;
    description: string;
  }
> = {
  subscribersGained: {
    label: "新增订阅",
    description: "查看每天带来的新增订阅",
  },
  subscribersLost: {
    label: "流失订阅",
    description: "查看每天发生的订阅流失",
  },
};

function hasPositiveValue(values: number[]) {
  return values.some((value) => value > 0);
}

function StudioChartEmpty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex h-[250px] items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function ChartFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[1.35rem] border border-border/70 bg-background/70 shadow-xs backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

function TooltipMetricRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-36 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function DashboardViewsChart({
  data,
}: {
  data: DashboardTrendPoint[];
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const hasData = hasPositiveValue(data.map((item) => item.views));

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-background/40 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <Badge variant="outline" className="mb-1 w-fit rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.16em] uppercase">
            Channel Trend
          </Badge>
          <CardTitle>近 14 天观看趋势</CardTitle>
          <CardDescription>观察频道流量在最近两周的变化节奏。</CardDescription>
        </div>
        <Badge variant="outline" className="w-fit">
          最近 14 天
        </Badge>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartFrame className="p-3 sm:p-4">
            <ChartContainer config={dashboardViewsConfig} className="aspect-auto h-[250px] w-full">
              <AreaChart data={data} accessibilityLayer>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.12} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) => formatShortDate(value)}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) => formatLongDate(value as string)}
                      formatter={(value) => (
                        <TooltipMetricRow
                          label="观看次数"
                          value={formatCompactNumber(Number(value))}
                        />
                      )}
                    />
                  }
                />
                <Area
                  dataKey="views"
                  type="natural"
                  fill={`url(#${gradientId})`}
                  stroke="var(--color-views)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </ChartFrame>
        ) : (
          <StudioChartEmpty
            title="近 14 天还没有可展示的观看趋势"
            description="跑过聚合任务后，这里会开始显示每天的播放变化。"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function VideoTypeDonutChart({
  data,
  title,
  description,
}: {
  data: VideoTypeBreakdown;
  title: string;
  description?: string;
}) {
  const totalCount = React.useMemo(
    () => data.reduce((result, item) => result + item.count, 0),
    [data],
  );
  const totalViews = React.useMemo(
    () => data.reduce((result, item) => result + item.views, 0),
    [data],
  );
  const singleType = data.length === 1;
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        key: item.type === "LONG" ? "long" : "short",
        type: item.type,
        label: formatVideoTypeLabel(item.type),
        count: item.count,
        views: item.views,
        fill: item.type === "LONG" ? "var(--color-long)" : "var(--color-short)",
      })),
    [data],
  );

  return (
    <Card className="flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-sm backdrop-blur-sm pt-0 pb-0">
      <CardHeader className="items-center border-b border-border/70 bg-background/40 pb-5 text-center pt-6">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        {totalCount > 0 ? (
          <ChartContainer config={videoTypeConfig} className="mx-auto mt-6 aspect-square max-h-[250px] w-full max-w-[280px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    nameKey="key"
                    labelFormatter={() => "内容结构"}
                    formatter={(value, _name, item) => {
                      const payload = item.payload as (typeof chartData)[number];

                      return (
                        <TooltipMetricRow
                          label={payload.label}
                          value={`${Number(value).toLocaleString("zh-CN")} 个`}
                        />
                      );
                    }}
                  />
                }
              />
              <Pie data={chartData} dataKey="count" nameKey="key" innerRadius={62} strokeWidth={5}>
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null;
                    }

                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-semibold">
                          {totalCount.toLocaleString("zh-CN")}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground text-sm"
                        >
                          视频数
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="key" />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="还没有内容结构数据"
            description="发布长视频或短视频后，这里会展示你的内容分布。"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TrendMetricChart({
  data,
}: {
  data: StatTrendPoint[];
}) {
  const [activeMetric, setActiveMetric] = React.useState<TrendMetricKey>("views");
  const chartId = React.useId().replace(/:/g, "");
  const hasData = React.useMemo(
    () => data.some((item) => item.views > 0 || item.watchTimeHours > 0),
    [data],
  );
  const activeMeta = trendMetricMeta[activeMetric];
  const gradientId = `${chartId}-${activeMetric}`;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-border/70 bg-background/40 px-6 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>30 天趋势探索</CardTitle>
          <CardDescription>{activeMeta.description}</CardDescription>
        </div>
        <ToggleGroup
          type="single"
          value={activeMetric}
          onValueChange={(value) => {
            if (value) {
              setActiveMetric(value as TrendMetricKey);
            }
          }}
          variant="outline"
          className="hidden sm:ml-auto sm:flex"
          aria-label="选择指标"
        >
          <ToggleGroupItem value="views">观看次数</ToggleGroupItem>
          <ToggleGroupItem value="watchTimeHours">观看时长</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={trendMetricConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart accessibilityLayer data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${activeMetric})`} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={`var(--color-${activeMetric})`} stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value) => formatShortDate(value)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value) => (
                      <TooltipMetricRow
                        label={activeMeta.label}
                        value={activeMeta.formatValue(Number(value))}
                      />
                    )}
                  />
                }
              />
              <Area
                dataKey={activeMetric}
                type="natural"
                fill={`url(#${gradientId})`}
                stroke={`var(--color-${activeMetric})`}
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近 30 天还没有趋势数据"
            description="当频道日统计开始累计后，这里会展示播放和观看时长趋势。"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function SubscriberFlowChart({
  data,
}: {
  data: StatTrendPoint[];
}) {
  const [activeMetric, setActiveMetric] = React.useState<SubscriberMetricKey>("subscribersGained");
  const hasData = React.useMemo(
    () => data.some((item) => item.subscribersGained > 0 || item.subscribersLost > 0),
    [data],
  );
  const activeMeta = subscriberMetricMeta[activeMetric];

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 py-0 pb-6 shadow-sm backdrop-blur-sm h-fit">
      <CardHeader className="flex flex-col items-stretch border-b pb-0! border-border/70 bg-background/40 p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 pt-8">
          <CardTitle>订阅变化</CardTitle>
          <CardDescription>{activeMeta.description}</CardDescription>
        </div>
        <div className="flex">
          {(["subscribersGained", "subscribersLost"] as const).map((metric) => (
            <button
              key={metric}
              type="button"
              onClick={() => setActiveMetric(metric)}
              data-active={activeMetric === metric}
              className={cn(
                "relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left transition-colors even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6",
                "hover:bg-accent hover:text-accent-foreground",
                "data-[active=true]:bg-muted/50",
              )}
            >
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {subscriberMetricMeta[metric].label}
              </span>
              <span className="text-base leading-none font-semibold whitespace-nowrap sm:text-2xl">
                {formatCompactNumber(data.reduce((result, item) => result + item[metric], 0))}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={subscriberMetricConfig} className="aspect-auto h-[250px] w-full">
            <BarChart
              accessibilityLayer
              data={data}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value) => formatShortDate(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    nameKey={activeMetric}
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value) => (
                      <TooltipMetricRow
                        label={subscriberMetricMeta[activeMetric].label}
                        value={Number(value).toLocaleString("zh-CN")}
                      />
                    )}
                  />
                }
              />
              <Bar dataKey={activeMetric} fill={`var(--color-${activeMetric})`} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="还没有订阅变化数据"
            description="当频道开始获得或流失订阅后，这里会展示每天的订阅变化。"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function TopVideoProgress({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const percent = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{`占榜首 ${formatPercent(percent)}`}</p>
    </div>
  );
}

export function VideoViewsTrendChart({
  data,
}: {
  data: VideoTrendPoint[];
}) {
  const chartId = React.useId().replace(/:/g, "");
  const viewsGradientId = `${chartId}-views`;
  const uniqueViewersGradientId = `${chartId}-unique-viewers`;
  const hasData = React.useMemo(
    () => data.some((item) => item.views > 0 || item.uniqueViewers > 0),
    [data],
  );

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-2 border-b border-border/70 bg-background/40 px-6 py-5">
        <CardTitle>30 天播放趋势</CardTitle>
        <CardDescription>对比观看次数和独立观众，判断这条视频的持续触达能力。</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={videoTrendConfig} className="aspect-auto h-[300px] w-full">
            <AreaChart accessibilityLayer data={data} margin={{ left: 12, right: 12 }}>
              <defs>
                <linearGradient id={viewsGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id={uniqueViewersGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-uniqueViewers)" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="var(--color-uniqueViewers)" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value) => formatShortDate(value)}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value, name) => (
                      <TooltipMetricRow
                        label={name === "uniqueViewers" ? "独立观众" : "观看次数"}
                        value={formatCompactNumber(Number(value))}
                      />
                    )}
                  />
                }
              />
              <Area
                dataKey="views"
                type="natural"
                fill={`url(#${viewsGradientId})`}
                stroke="var(--color-views)"
                strokeWidth={2.2}
              />
              <Area
                dataKey="uniqueViewers"
                type="natural"
                fill={`url(#${uniqueViewersGradientId})`}
                stroke="var(--color-uniqueViewers)"
                strokeWidth={2.2}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近 30 天还没有播放趋势数据"
            description="当这条视频开始产生稳定播放后，这里会展示播放和独立观众变化。"
          />
        )}
      </CardContent>
    </Card>
  );
}

export function VideoEngagementChart({
  data,
}: {
  data: VideoTrendPoint[];
}) {
  const hasData = React.useMemo(
    () => data.some((item) => item.likesGained > 0 || item.commentsGained > 0),
    [data],
  );

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 py-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-2 border-b border-border/70 bg-background/40 px-6 py-5">
        <CardTitle>互动增量</CardTitle>
        <CardDescription>查看这条视频在近 30 天内带来的点赞和评论变化。</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={videoEngagementConfig} className="aspect-auto h-[260px] w-full">
            <LineChart
              accessibilityLayer
              data={data}
              margin={{
                left: 12,
                right: 12,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={24}
                tickFormatter={(value) => formatShortDate(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value, name) => (
                      <TooltipMetricRow
                        label={name === "commentsGained" ? "新增评论" : "新增点赞"}
                        value={Number(value).toLocaleString("zh-CN")}
                      />
                    )}
                  />
                }
              />
              <Line
                dataKey="likesGained"
                type="monotone"
                stroke="var(--color-likesGained)"
                strokeWidth={2.5}
                dot={false}
              />
              <Line
                dataKey="commentsGained"
                type="monotone"
                stroke="var(--color-commentsGained)"
                strokeWidth={2.5}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </LineChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近 30 天还没有互动增量数据"
            description="当这条视频收到点赞或评论后，这里会开始显示互动变化。"
          />
        )}
      </CardContent>
    </Card>
  );
}
