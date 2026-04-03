"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatCompactNumber,
  formatHoursLabel,
  formatLongDate,
  formatPercent,
  formatShortDate,
} from "@/components/studio/analytics/utils";
import { cn } from "@/lib/utils";

type VideoDailyDetailPoint = {
  date: string;
  views: number;
  uniqueViewers: number;
  watchTimeHours: number;
  likesGained: number;
  commentsGained: number;
};

type ChartInteractionState = {
  activeTooltipIndex?: number | string | null;
  isTooltipActive?: boolean;
};

type PrimaryMetricKey = "views" | "uniqueViewers" | "watchTimeHours";
type SecondaryMetricKey = "likesGained" | "commentsGained";
type MetricKey = PrimaryMetricKey | SecondaryMetricKey;

type MetricMeta = {
  label: string;
  description: string;
  color: string;
  formatValue: (value: number) => string;
};

const PRIMARY_METRICS = ["views", "uniqueViewers", "watchTimeHours"] as const;
const SECONDARY_METRICS = ["likesGained", "commentsGained"] as const;
const ALL_METRICS = [...PRIMARY_METRICS, ...SECONDARY_METRICS] as const;

const chartConfig = {
  views: {
    label: "观看次数",
    color: "var(--chart-1)",
  },
  uniqueViewers: {
    label: "独立观众",
    color: "var(--chart-2)",
  },
  watchTimeHours: {
    label: "观看时长",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const metricMeta: Record<MetricKey, MetricMeta> = {
  views: {
    label: "观看次数",
    description: "观察这条视频每天的播放触达强度。",
    color: "var(--color-views)",
    formatValue: formatCompactNumber,
  },
  uniqueViewers: {
    label: "独立观众",
    description: "查看每日真正触达了多少不同观众。",
    color: "var(--color-uniqueViewers)",
    formatValue: formatCompactNumber,
  },
  watchTimeHours: {
    label: "观看时长",
    description: "衡量这条视频每天带来的实际消费时长。",
    color: "var(--color-watchTimeHours)",
    formatValue: formatHoursLabel,
  },
  likesGained: {
    label: "新增点赞",
    description: "查看每天新增的点赞反馈。",
    color: "var(--chart-4)",
    formatValue: (value) => value.toLocaleString("zh-CN"),
  },
  commentsGained: {
    label: "新增评论",
    description: "查看每天新增的评论反馈。",
    color: "var(--chart-5)",
    formatValue: (value) => value.toLocaleString("zh-CN"),
  },
};

function AnalyticsEmptyState() {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
      <CardHeader className="border-b border-border/70 bg-background/40 pt-6">
        <CardTitle>30 天日明细</CardTitle>
        <CardDescription>逐天查看这条视频的播放、独立观众和互动变化</CardDescription>
      </CardHeader>
      <CardContent className="py-10">
        <div className="flex min-h-60 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-6 text-center">
          <div className="flex max-w-sm flex-col gap-1">
            <p className="font-medium">最近 30 天还没有日明细趋势</p>
            <p className="text-sm text-muted-foreground">
              当这条视频开始产生稳定播放与互动后，这里会展示逐日变化。
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getAverage(data: VideoDailyDetailPoint[], metric: MetricKey) {
  if (data.length === 0) {
    return 0;
  }

  const total = data.reduce((result, item) => result + item[metric], 0);
  return total / data.length;
}

function getMax(data: VideoDailyDetailPoint[], metric: MetricKey) {
  return data.reduce((result, item) => Math.max(result, item[metric]), 0);
}

function getRank(data: VideoDailyDetailPoint[], metric: MetricKey, value: number) {
  const sorted = data.map((item) => item[metric]).sort((left, right) => right - left);
  return Math.max(sorted.findIndex((item) => item === value) + 1, 1);
}

function getDeltaFromAverageLabel(value: number, average: number) {
  if (average <= 0) {
    return value > 0 ? "这一天开始出现明显数据" : "近 30 天暂无可比基线";
  }

  const deltaRatio = ((value - average) / average) * 100;

  if (Math.abs(deltaRatio) < 5) {
    return "与近 30 天日均基本持平";
  }

  return deltaRatio > 0
    ? `较日均高 ${formatPercent(Math.abs(deltaRatio))}`
    : `较日均低 ${formatPercent(Math.abs(deltaRatio))}`;
}

function getPeakCoverageLabel(value: number, max: number) {
  if (max <= 0) {
    return "近 30 天暂无峰值数据";
  }

  return `达到近 30 天峰值的 ${formatPercent((value / max) * 100)}`;
}

function getChartRowFromState(data: VideoDailyDetailPoint[], state: ChartInteractionState) {
  if (state.activeTooltipIndex == null) {
    return null;
  }

  const index =
    typeof state.activeTooltipIndex === "number"
      ? state.activeTooltipIndex
      : Number(state.activeTooltipIndex);

  return Number.isFinite(index) ? data[index] ?? null : null;
}

function getEngagementInsight(item: VideoDailyDetailPoint, averages: Record<MetricKey, number>) {
  const interactions = item.likesGained + item.commentsGained;
  const averageInteractions = averages.likesGained + averages.commentsGained;
  const highReach = item.views >= averages.views * 1.1;
  const highInteraction = interactions >= averageInteractions * 1.1;
  const uniqueRatio = item.views > 0 ? item.uniqueViewers / item.views : 0;

  let headline = "整体表现接近日常水平。";

  if (highReach && highInteraction) {
    headline = "这一天的播放和互动同步走强，属于近 30 天的高表现日。";
  } else if (highReach) {
    headline = "这一天触达扩张很明显，但互动转化相对克制。";
  } else if (highInteraction) {
    headline = "这一天互动反馈更集中，说明观众回应意愿更强。";
  }

  const ratioDetail =
    item.views > 0
      ? `独立观众约占总观看的 ${formatPercent(uniqueRatio * 100)}，可用来判断新触达质量。`
      : "当天还没有形成有效观看，因此触达结构信号有限。";

  return {
    headline,
    ratioDetail,
  };
}

function HighlightDot({
  cx,
  cy,
  index,
  activeIndex,
  color,
}: {
  cx?: number;
  cy?: number;
  index?: number;
  activeIndex: number;
  color: string;
}) {
  if (index !== activeIndex || typeof cx !== "number" || typeof cy !== "number") {
    return null;
  }

  return <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--background)" strokeWidth={2.5} />;
}

function DailyDetailTooltip({
  active,
  label,
  rowsByDate,
}: {
  active?: boolean;
  label?: string;
  rowsByDate: Map<string, VideoDailyDetailPoint>;
}) {
  if (!active || !label) {
    return null;
  }

  const row = rowsByDate.get(label);

  if (!row) {
    return null;
  }

  return (
    <div className="grid min-w-44 gap-2 rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium">{formatLongDate(row.date)}</p>
      <div className="grid gap-1.5">
        {PRIMARY_METRICS.map((metric) => (
          <div key={metric} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{metricMeta[metric].label}</span>
            <span className="font-medium">{metricMeta[metric].formatValue(row[metric])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryPanel({
  label,
  value,
  helper,
  accentColor,
}: {
  label: string;
  value: string;
  helper: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: accentColor }} />
        <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function PrimaryMetricCell({
  value,
  max,
  formatValue,
  color,
}: {
  value: number;
  max: number;
  formatValue: (value: number) => string;
  color: string;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 8 : 0) : 0;

  return (
    <div className="flex min-w-32 flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium tabular-nums">{formatValue(value)}</span>
        <span className="text-[11px] text-muted-foreground">
          {max > 0 ? `${formatPercent((value / max) * 100)} 峰值` : "—"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function SecondaryMetricCell({
  value,
  max,
  label,
  color,
}: {
  value: number;
  max: number;
  label: string;
  color: string;
}) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 10 : 0) : 0;

  return (
    <div className="flex min-w-24 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge variant={value > 0 ? "secondary" : "outline"} className="font-mono tabular-nums">
          {value.toLocaleString("zh-CN")}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/70">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${width}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export function VideoDailyDetailExplorer({
  data,
}: {
  data: VideoDailyDetailPoint[];
}) {
  const isMobile = useIsMobile();
  const [activeMetric, setActiveMetric] = React.useState<PrimaryMetricKey>("views");
  const [selectedDate, setSelectedDate] = React.useState<string | null>(data.at(-1)?.date ?? null);
  const [hoveredDate, setHoveredDate] = React.useState<string | null>(null);
  const [drawerDate, setDrawerDate] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);

  const hasMeaningfulData = React.useMemo(
    () =>
      data.some(
        (item) =>
          item.views > 0 ||
          item.uniqueViewers > 0 ||
          item.watchTimeHours > 0 ||
          item.likesGained > 0 ||
          item.commentsGained > 0,
      ),
    [data],
  );

  const rowsByDate = React.useMemo(() => new Map(data.map((item) => [item.date, item])), [data]);
  const reversedRows = React.useMemo(() => data.slice().reverse(), [data]);

  const averages = React.useMemo(
    () =>
      Object.fromEntries(ALL_METRICS.map((metric) => [metric, getAverage(data, metric)])) as Record<
        MetricKey,
        number
      >,
    [data],
  );

  const maxima = React.useMemo(
    () =>
      Object.fromEntries(ALL_METRICS.map((metric) => [metric, getMax(data, metric)])) as Record<
        MetricKey,
        number
      >,
    [data],
  );

  const totals = React.useMemo(
    () =>
      Object.fromEntries(
        ALL_METRICS.map((metric) => [metric, data.reduce((result, item) => result + item[metric], 0)]),
      ) as Record<MetricKey, number>,
    [data],
  );

  const activeDate = hoveredDate ?? selectedDate ?? data.at(-1)?.date ?? null;
  const activeIndex = React.useMemo(
    () => Math.max(data.findIndex((item) => item.date === activeDate), 0),
    [activeDate, data],
  );
  const activeRow = activeDate ? rowsByDate.get(activeDate) ?? null : null;
  const drawerRow = drawerDate ? rowsByDate.get(drawerDate) ?? null : null;
  const activeMetricInfo = metricMeta[activeMetric];

  const activePeakRow = React.useMemo(() => {
    const maxValue = maxima[activeMetric];
    return data.find((item) => item[activeMetric] === maxValue) ?? null;
  }, [activeMetric, data, maxima]);

  React.useEffect(() => {
    if (!selectedDate && data.length > 0) {
      setSelectedDate(data[data.length - 1]?.date ?? null);
    }
  }, [data, selectedDate]);

  if (!hasMeaningfulData) {
    return <AnalyticsEmptyState />;
  }

  const openDrawerForDate = (date: string) => {
    setSelectedDate(date);
    setDrawerDate(date);
    setOpen(true);
  };

  const drawerInsight = drawerRow ? getEngagementInsight(drawerRow, averages) : null;

  return (
    <Drawer direction={isMobile ? "bottom" : "right"} open={open} onOpenChange={setOpen}>
      <Card className="overflow-hidden border-border/70 bg-card/95 pt-0 shadow-sm backdrop-blur-sm">
        <CardHeader className="border-b border-border/70 bg-background/40 py-5">
          <div className="grid gap-1">
            <CardTitle>30 天日明细</CardTitle>
            <CardDescription>图表看趋势，表格看每一天的强弱和互动落点。</CardDescription>
          </div>
          <CardAction className="w-full sm:w-auto">
            <ToggleGroup
              type="single"
              value={activeMetric}
              onValueChange={(value) => {
                if (value) {
                  setActiveMetric(value as PrimaryMetricKey);
                }
              }}
              variant="outline"
              className="grid w-full grid-cols-3 sm:flex"
              aria-label="切换主指标"
            >
              <ToggleGroupItem value="views">观看</ToggleGroupItem>
              <ToggleGroupItem value="uniqueViewers">独立观众</ToggleGroupItem>
              <ToggleGroupItem value="watchTimeHours">观看时长</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6 px-3 pt-4 sm:px-6 sm:pt-6">
          <div className="grid gap-3 lg:grid-cols-3">
            <SummaryPanel
              label="30 天累计"
              value={activeMetricInfo.formatValue(totals[activeMetric])}
              helper={`${activeMetricInfo.label} 的近 30 天总量`}
              accentColor={activeMetricInfo.color}
            />
            <SummaryPanel
              label="单日峰值"
              value={activeMetricInfo.formatValue(maxima[activeMetric])}
              helper={activePeakRow ? `${formatShortDate(activePeakRow.date)} 达到最高点` : "暂无峰值"}
              accentColor={activeMetricInfo.color}
            />
            <SummaryPanel
              label="日均水平"
              value={activeMetricInfo.formatValue(averages[activeMetric])}
              helper={activeMetricInfo.description}
              accentColor={activeMetricInfo.color}
            />
          </div>

          <div className="rounded-[1.35rem] border border-border/70 bg-background/70 p-3 shadow-xs backdrop-blur-sm sm:p-4">
            <ChartContainer config={chartConfig} className="aspect-auto h-[300px] w-full">
              <AreaChart
                accessibilityLayer
                data={data}
                margin={{ left: 12, right: 12 }}
                onMouseLeave={() => setHoveredDate(null)}
                onMouseMove={(state: ChartInteractionState) => {
                  if (!state.isTooltipActive) {
                    return;
                  }

                  const hoveredRow = getChartRowFromState(data, state);

                  if (hoveredRow) {
                    setHoveredDate(hoveredRow.date);
                  }
                }}
                onClick={(state: ChartInteractionState) => {
                  const clickedRow = getChartRowFromState(data, state);

                  if (clickedRow) {
                    openDrawerForDate(clickedRow.date);
                  }
                }}
              >
                <defs>
                  <linearGradient id={`fill-${activeMetric}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeMetricInfo.color} stopOpacity={0.55} />
                    <stop offset="95%" stopColor={activeMetricInfo.color} stopOpacity={0.08} />
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
                {activeDate ? (
                  <ReferenceLine
                    x={activeDate}
                    stroke="color-mix(in srgb, var(--foreground) 16%, transparent)"
                    strokeDasharray="4 4"
                  />
                ) : null}
                <ChartTooltip
                  cursor={false}
                  content={<DailyDetailTooltip rowsByDate={rowsByDate} />}
                />
                <Area
                  dataKey={activeMetric}
                  type="natural"
                  fill={`url(#fill-${activeMetric})`}
                  stroke={activeMetricInfo.color}
                  strokeWidth={2.5}
                  dot={(props) => (
                    <HighlightDot
                      cx={props.cx}
                      cy={props.cy}
                      index={props.index}
                      activeIndex={activeIndex}
                      color={activeMetricInfo.color}
                    />
                  )}
                  activeDot={{
                    r: 6,
                    fill: activeMetricInfo.color,
                    stroke: "var(--background)",
                    strokeWidth: 2.5,
                  }}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <div>
                <p className="font-medium">逐日分析表</p>
                <p className="text-sm text-muted-foreground">
                  当前主视角：{activeMetricInfo.label}。悬停联动图表，点击某一天查看详情。
                </p>
              </div>
              {activeRow ? (
                <Badge variant="outline" className="hidden sm:inline-flex">
                  聚焦 {formatShortDate(activeRow.date)}
                </Badge>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-28">日期</TableHead>
                    <TableHead>观看</TableHead>
                    <TableHead>独立观众</TableHead>
                    <TableHead>观看时长</TableHead>
                    <TableHead>新增点赞</TableHead>
                    <TableHead>新增评论</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reversedRows.map((row) => {
                    const isActive = row.date === activeDate;
                    const isSelected = row.date === selectedDate;

                    return (
                      <TableRow
                        key={row.date}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/30",
                          isActive && "bg-muted/40",
                          isSelected && "ring-1 ring-inset ring-border/80",
                        )}
                        tabIndex={0}
                        onMouseEnter={() => setHoveredDate(row.date)}
                        onMouseLeave={() => setHoveredDate(null)}
                        onFocus={() => setHoveredDate(row.date)}
                        onBlur={() => setHoveredDate(null)}
                        onClick={() => openDrawerForDate(row.date)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openDrawerForDate(row.date);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{formatShortDate(row.date)}</span>
                            <span className="text-xs text-muted-foreground">
                              {row.date === data[data.length - 1]?.date ? "最新一天" : "历史明细"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <PrimaryMetricCell
                            value={row.views}
                            max={maxima.views}
                            formatValue={metricMeta.views.formatValue}
                            color={metricMeta.views.color}
                          />
                        </TableCell>
                        <TableCell>
                          <PrimaryMetricCell
                            value={row.uniqueViewers}
                            max={maxima.uniqueViewers}
                            formatValue={metricMeta.uniqueViewers.formatValue}
                            color={metricMeta.uniqueViewers.color}
                          />
                        </TableCell>
                        <TableCell>
                          <PrimaryMetricCell
                            value={row.watchTimeHours}
                            max={maxima.watchTimeHours}
                            formatValue={metricMeta.watchTimeHours.formatValue}
                            color={metricMeta.watchTimeHours.color}
                          />
                        </TableCell>
                        <TableCell>
                          <SecondaryMetricCell
                            value={row.likesGained}
                            max={maxima.likesGained}
                            label="点赞"
                            color={metricMeta.likesGained.color}
                          />
                        </TableCell>
                        <TableCell>
                          <SecondaryMetricCell
                            value={row.commentsGained}
                            max={maxima.commentsGained}
                            label="评论"
                            color={metricMeta.commentsGained.color}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-1 border-t border-border/70 bg-background/20 py-4 text-sm">
          <p className="font-medium">主图用于判断趋势，表格用于判断每天的强弱结构。</p>
          <p className="text-muted-foreground">点击图表节点或表格行，可以展开该日的完整指标和表现解读。</p>
        </CardFooter>
      </Card>

      <DrawerContent className="sm:max-w-xl">
        {drawerRow ? (
          <>
            <DrawerHeader className="gap-2 border-b border-border/70">
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <Badge variant="outline">逐日详情</Badge>
                <Badge variant="secondary">{formatShortDate(drawerRow.date)}</Badge>
              </div>
              <DrawerTitle>{formatLongDate(drawerRow.date)}</DrawerTitle>
              <DrawerDescription>对照近 30 天均值和峰值，快速判断这一天的触达与互动质量。</DrawerDescription>
            </DrawerHeader>
            <div className="flex flex-col gap-6 overflow-y-auto p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {ALL_METRICS.map((metric) => (
                  <div key={metric} className="rounded-xl border border-border/70 bg-background/70 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{metricMeta[metric].label}</p>
                      <Badge variant="outline">第 {getRank(data, metric, drawerRow[metric])} / {data.length}</Badge>
                    </div>
                    <p className="mt-2 text-xl font-semibold tabular-nums">
                      {metricMeta[metric].formatValue(drawerRow[metric])}
                    </p>
                    <div className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
                      <span>{getDeltaFromAverageLabel(drawerRow[metric], averages[metric])}</span>
                      <span>{getPeakCoverageLabel(drawerRow[metric], maxima[metric])}</span>
                    </div>
                  </div>
                ))}
              </div>

              {drawerInsight ? (
                <div className="rounded-xl border border-border/70 bg-muted/20 px-4 py-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">当日判断</Badge>
                    <span className="text-sm text-muted-foreground">帮助快速定位“高播放低互动”或“反馈爆发”</span>
                  </div>
                  <p className="mt-3 font-medium">{drawerInsight.headline}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{drawerInsight.ratioDetail}</p>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <SummaryPanel
                  label="观看"
                  value={formatCompactNumber(drawerRow.views)}
                  helper={getDeltaFromAverageLabel(drawerRow.views, averages.views)}
                  accentColor={metricMeta.views.color}
                />
                <SummaryPanel
                  label="独立观众"
                  value={formatCompactNumber(drawerRow.uniqueViewers)}
                  helper={getDeltaFromAverageLabel(drawerRow.uniqueViewers, averages.uniqueViewers)}
                  accentColor={metricMeta.uniqueViewers.color}
                />
                <SummaryPanel
                  label="互动总量"
                  value={(drawerRow.likesGained + drawerRow.commentsGained).toLocaleString("zh-CN")}
                  helper={`点赞 ${drawerRow.likesGained.toLocaleString("zh-CN")} / 评论 ${drawerRow.commentsGained.toLocaleString("zh-CN")}`}
                  accentColor={metricMeta.commentsGained.color}
                />
              </div>
            </div>
            <DrawerFooter className="border-t border-border/70">
              <DrawerClose asChild>
                <Button variant="outline">关闭</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
