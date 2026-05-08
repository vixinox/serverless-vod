"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Label, Line, Pie, PieChart, XAxis, YAxis } from "recharts";
import type { DashboardPageData, StatPageData, VideoAnalyticsPageData } from "@/lib/server/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  formatDecimalPercent,
  formatDurationSeconds,
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
  averageViewSeconds: number;
  rollingViews7d: number;
  subscriberPerThousandViews: number;
  subscribersNet: number;
  subscribersGained: number;
  subscribersLost: number;
};

type VideoTrendPoint = {
  date: VideoAnalyticsPageData["trend30d"][number]["date"] | string;
  views: number;
  uniqueViewers: number;
  watchTimeHours: number;
  averageViewSeconds: number;
  completionRate: number | null;
  engagementRate: number;
  feedbackRate: number;
  positiveRate: number | null;
  likesGained: number;
  dislikesGained: number;
  reactionsGained: number;
  commentsGained: number;
};

type TrendMetricKey = "views" | "averageViewSeconds" | "subscriberPerThousandViews";
type SubscriberMetricKey = "subscribersGained" | "subscribersLost";
type VideoQualityMetricKey = "averageViewSeconds" | "completionRate" | "engagementRate";

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
  rollingViews7d: {
    label: "7 日均线",
    color: "var(--chart-2)",
  },
  averageViewSeconds: {
    label: "平均观看",
    color: "var(--chart-3)",
  },
  subscriberPerThousandViews: {
    label: "订阅转化",
    color: "var(--chart-4)",
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
  averageViewSeconds: {
    label: "平均观看",
    color: "var(--chart-2)",
  },
  completionRate: {
    label: "估算完播",
    color: "var(--chart-3)",
  },
  engagementRate: {
    label: "互动率",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const videoEngagementConfig = {
  likesGained: {
    label: "新增点赞",
    color: "var(--chart-3)",
  },
  dislikesGained: {
    label: "新增点踩",
    color: "var(--chart-2)",
  },
  commentsGained: {
    label: "新增评论",
    color: "var(--chart-5)",
  },
  positiveRate: {
    label: "好评率",
    color: "var(--chart-4)",
  },
} satisfies ChartConfig;

const trendMetricMeta: Record<
  TrendMetricKey,
  {
    label: string;
    formatValue: (value: number) => string;
  }
> = {
  views: {
    label: "观看次数",
    formatValue: formatCompactNumber,
  },
  averageViewSeconds: {
    label: "平均观看",
    formatValue: formatDurationSeconds,
  },
  subscriberPerThousandViews: {
    label: "订阅转化",
    formatValue: (value) => `${value.toFixed(2).replace(".00", "")}/千次`,
  },
};

const subscriberMetricMeta: Record<
  SubscriberMetricKey,
  {
    label: string;
  }
> = {
  subscribersGained: {
    label: "新增订阅",
  },
  subscribersLost: {
    label: "流失订阅",
  },
};

function hasPositiveValue(values: number[]) {
  return values.some((value) => value > 0);
}

function getPositiveYAxisMax(values: number[]) {
  const maxValue = values.reduce((currentMax, value) => {
    return value > currentMax ? value : currentMax;
  }, 0);

  if (maxValue <= 0) {
    return 1;
  }

  const paddedMax = maxValue * 1.15;

  if (paddedMax < 10) {
    return Number(paddedMax.toFixed(2));
  }

  if (paddedMax < 100) {
    return Math.ceil(paddedMax);
  }

  if (paddedMax < 1000) {
    return Math.ceil(paddedMax / 10) * 10;
  }

  if (paddedMax < 10000) {
    return Math.ceil(paddedMax / 100) * 100;
  }

  return Math.ceil(paddedMax / 1000) * 1000;
}

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
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
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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

function ToneBadge({ tone, children }: { tone: "up" | "flat" | "down" | "neutral"; children: React.ReactNode }) {
  return (
    <Badge
      variant={tone === "down" ? "destructive" : tone === "neutral" ? "outline" : "secondary"}
      className="w-fit rounded-full px-2.5 py-1"
    >
      {children}
    </Badge>
  );
}

export function DashboardViewsChart({
  data,
}: {
  data: DashboardTrendPoint[];
}) {
  const gradientId = React.useId().replace(/:/g, "");
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        views: clampNonNegative(item.views),
      })),
    [data],
  );
  const hasData = hasPositiveValue(chartData.map((item) => item.views));
  const yAxisMax = React.useMemo(
    () => getPositiveYAxisMax(chartData.map((item) => item.views)),
    [chartData],
  );

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-3 border-b border-border/70 bg-background/40 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <Badge variant="outline" className="mb-1 w-fit rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.16em] uppercase">
            Channel Trend
          </Badge>
          <CardTitle>近 14 天观看趋势</CardTitle>
        </div>
        <Badge variant="outline" className="w-fit">
          最近 14 天
        </Badge>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartFrame className="p-3 sm:p-4">
            <ChartContainer config={dashboardViewsConfig} className="aspect-auto h-[250px] w-full">
              <AreaChart data={chartData} accessibilityLayer>
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
                <YAxis hide domain={[0, yAxisMax]} />
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
                  type="monotoneX"
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
            description=""
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
        {description ? <CardDescription>{description}</CardDescription> : null}
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
            description=""
          />
        )}
      </CardContent>
    </Card>
  );
}

export function ChannelDiagnosisStrip({
  insights,
}: {
  insights: StatPageData["diagnostics"];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {insights.map((item) => (
        <Card key={item.title} className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <CardDescription>{item.title}</CardDescription>
              <ToneBadge tone={item.tone}>{item.value}</ToneBadge>
            </div>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}

export function ContentTypeRingChart({
  data,
}: {
  data: StatPageData["contentTypePerformance"];
}) {
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        label: formatVideoTypeLabel(item.type),
        averageViews: clampNonNegative(item.averageViews),
        averageViewSeconds: clampNonNegative(item.averageViewSeconds),
        fill: item.type === "LONG" ? "var(--color-long)" : "var(--color-short)",
      })),
    [data],
  );
  const totalViews = chartData.reduce((result, item) => result + item.views, 0);
  const hasData = chartData.some((item) => item.views > 0 || item.count > 0);

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="border-b border-border/70 bg-background/40 px-6 py-5">
        <CardTitle>长短视频占比</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-4 pt-4 pb-5 sm:px-6 sm:pt-6">
        {hasData ? (
          <>
            <ChartContainer config={videoTypeConfig} className="mx-auto aspect-square h-[250px] w-full max-w-[280px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(_value, _name, item) => {
                      const payload = item.payload as (typeof chartData)[number];

                      return (
                        <div className="grid gap-1.5">
                          <TooltipMetricRow label="平均播放/条" value={formatCompactNumber(payload.averageViews)} />
                          <TooltipMetricRow label="30 天播放" value={formatCompactNumber(payload.views)} />
                          <TooltipMetricRow label="平均观看" value={formatDurationSeconds(payload.averageViewSeconds)} />
                        </div>
                      );
                    }}
                  />
                }
              />
              <Pie data={chartData} dataKey="views" nameKey="label" innerRadius={66} outerRadius={94} strokeWidth={5}>
                {chartData.map((item) => (
                  <Cell key={item.type} fill={item.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (!viewBox || !("cx" in viewBox) || !("cy" in viewBox)) {
                      return null;
                    }

                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                          {formatCompactNumber(totalViews)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                          className="fill-muted-foreground text-xs"
                        >
                          30 天播放
                        </tspan>
                      </text>
                    );
                  }}
                />
              </Pie>
            </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2">
              {chartData.map((item) => {
                const percent = totalViews > 0 ? (item.views / totalViews) * 100 : 0;

                return (
                  <div key={item.type} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ backgroundColor: item.fill }} />
                      <span className="font-medium">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{formatDecimalPercent(percent)}</span>
                      <span>{formatCompactNumber(item.averageViews)}/条</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <StudioChartEmpty title="暂无内容类型数据" description="" />
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
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        views: clampNonNegative(item.views),
        watchTimeHours: clampNonNegative(item.watchTimeHours),
      })),
    [data],
  );
  const hasData = React.useMemo(() => chartData.some((item) => item.views > 0), [chartData]);
  const yAxisMax = React.useMemo(
    () => getPositiveYAxisMax(chartData.map((item) => item[activeMetric])),
    [chartData, activeMetric],
  );
  const activeMeta = trendMetricMeta[activeMetric];
  const gradientId = `${chartId}-${activeMetric}`;

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-border/70 bg-background/40 px-6 py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>增长趋势</CardTitle>
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
          <ToggleGroupItem value="views">观看</ToggleGroupItem>
          <ToggleGroupItem value="averageViewSeconds">平均观看</ToggleGroupItem>
          <ToggleGroupItem value="subscriberPerThousandViews">订阅转化</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={trendMetricConfig} className="aspect-auto h-[250px] w-full">
            <AreaChart accessibilityLayer data={chartData}>
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
              <YAxis hide domain={[0, yAxisMax]} />
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
                type="monotoneX"
                fill={`url(#${gradientId})`}
                stroke={`var(--color-${activeMetric})`}
                strokeWidth={2}
              />
              {activeMetric === "views" ? (
                <Line
                  dataKey="rollingViews7d"
                  type="monotoneX"
                  stroke="var(--color-rollingViews7d)"
                  strokeWidth={2}
                  dot={false}
                />
              ) : null}
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近 30 天还没有趋势数据"
            description=""
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
  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 py-0 pb-6 shadow-sm backdrop-blur-sm h-fit">
      <CardHeader className="flex flex-col items-stretch border-b pb-0! border-border/70 bg-background/40 p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 pt-8">
          <CardTitle>订阅变化</CardTitle>
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
            description=""
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
  const [qualityMetric, setQualityMetric] = React.useState<VideoQualityMetricKey>("averageViewSeconds");
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        views: clampNonNegative(item.views),
        averageViewSeconds: clampNonNegative(item.averageViewSeconds),
        completionRate: item.completionRate === null ? 0 : clampNonNegative(item.completionRate),
        engagementRate: clampNonNegative(item.engagementRate),
      })),
    [data],
  );
  const hasData = React.useMemo(
    () => chartData.some((item) => item.views > 0 || item.averageViewSeconds > 0),
    [chartData],
  );
  const yAxisMax = React.useMemo(
    () => getPositiveYAxisMax(chartData.map((item) => item.views)),
    [chartData],
  );
  const qualityAxisMax = React.useMemo(
    () => getPositiveYAxisMax(chartData.map((item) => Number(item[qualityMetric] ?? 0))),
    [chartData, qualityMetric],
  );
  const qualityLabel =
    qualityMetric === "averageViewSeconds"
      ? "平均观看"
      : qualityMetric === "completionRate"
        ? "估算完播"
        : "互动率";
  const formatQualityValue = (value: number) => {
    if (qualityMetric === "averageViewSeconds") {
      return formatDurationSeconds(value);
    }

    return formatDecimalPercent(value);
  };

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex items-center gap-2 border-b border-border/70 bg-background/40 px-6 py-5 sm:flex-row">
        <CardTitle className="flex-1">播放质量</CardTitle>
        <ToggleGroup
          type="single"
          value={qualityMetric}
          onValueChange={(value) => {
            if (value) {
              setQualityMetric(value as VideoQualityMetricKey);
            }
          }}
          variant="outline"
          className="hidden sm:flex"
          aria-label="选择质量指标"
        >
          <ToggleGroupItem value="averageViewSeconds">平均观看</ToggleGroupItem>
          <ToggleGroupItem value="completionRate">完播</ToggleGroupItem>
          <ToggleGroupItem value="engagementRate">互动</ToggleGroupItem>
        </ToggleGroup>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={videoTrendConfig} className="aspect-auto h-[300px] w-full">
            <AreaChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
              <defs>
                <linearGradient id={viewsGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.1} />
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
              <YAxis hide domain={[0, yAxisMax]} />
              <YAxis yAxisId="quality" hide domain={[0, qualityAxisMax]} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value, name) => {
                      const key = String(name);

                      return (
                        <TooltipMetricRow
                          label={key === "views" ? "观看次数" : qualityLabel}
                          value={key === "views" ? formatCompactNumber(Number(value)) : formatQualityValue(Number(value))}
                        />
                      );
                    }}
                  />
                }
              />
              <Area
                dataKey="views"
                type="monotoneX"
                fill={`url(#${viewsGradientId})`}
                stroke="var(--color-views)"
                strokeWidth={2.2}
              />
              <Line
                yAxisId="quality"
                dataKey={qualityMetric}
                type="monotoneX"
                stroke={`var(--color-${qualityMetric})`}
                strokeWidth={2.5}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </AreaChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近 30 天还没有播放趋势数据"
            description=""
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
  const chartData = React.useMemo(
    () =>
      data.map((item) => ({
        ...item,
        likesGained: clampNonNegative(item.likesGained),
        dislikesGained: clampNonNegative(item.dislikesGained),
        commentsGained: clampNonNegative(item.commentsGained),
        positiveRate: item.positiveRate === null ? 0 : clampNonNegative(item.positiveRate),
      })),
    [data],
  );
  const hasData = React.useMemo(
    () => chartData.some((item) => item.likesGained > 0 || item.dislikesGained > 0 || item.commentsGained > 0),
    [chartData],
  );
  const yAxisMax = React.useMemo(
    () => getPositiveYAxisMax(chartData.map((item) => Math.max(item.likesGained, item.dislikesGained, item.commentsGained))),
    [chartData],
  );

  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 py-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="flex flex-col gap-2 border-b border-border/70 bg-background/40 px-6 py-5">
        <CardTitle>观众反馈</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {hasData ? (
          <ChartContainer config={videoEngagementConfig} className="aspect-auto h-[260px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
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
              <YAxis hide domain={[0, yAxisMax]} />
              <YAxis yAxisId="rate" hide domain={[0, 100]} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => formatLongDate(value as string)}
                    formatter={(value, name) => {
                      const key = String(name);
                      const label =
                        key === "commentsGained"
                          ? "新增评论"
                          : key === "dislikesGained"
                            ? "新增点踩"
                            : key === "positiveRate"
                              ? "好评率"
                              : "新增点赞";

                      return (
                        <TooltipMetricRow
                          label={label}
                          value={key === "positiveRate" ? formatDecimalPercent(Number(value)) : Number(value).toLocaleString("zh-CN")}
                        />
                      );
                    }}
                  />
                }
              />
              <Bar dataKey="likesGained" fill="var(--color-likesGained)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="dislikesGained" fill="var(--color-dislikesGained)" radius={[5, 5, 0, 0]} />
              <Bar dataKey="commentsGained" fill="var(--color-commentsGained)" radius={[5, 5, 0, 0]} />
              <Line
                yAxisId="rate"
                dataKey="positiveRate"
                type="monotoneX"
                stroke="var(--color-positiveRate)"
                strokeWidth={2.5}
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        ) : (
          <StudioChartEmpty
            title="最近还没有观众反馈"
            description=""
          />
        )}
      </CardContent>
    </Card>
  );
}
