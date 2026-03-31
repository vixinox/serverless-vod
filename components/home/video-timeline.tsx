"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  CalendarRange,
  ChevronDown,
  Clock3,
  Layers3,
  Sparkles,
} from "lucide-react";
import { VideoCard } from "@/components/home/video-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { GalleryVideoData } from "@/lib/server/videos";

gsap.registerPlugin(ScrollTrigger);

type TimelineUnit = "day" | "week" | "month";
type TimelineVariant = "saved" | "watch-later";

export type TimelineVideoItem = GalleryVideoData & {
  timelineAt: Date | string;
};

type TimelineGroup = {
  id: string;
  title: string;
  navLabel: string;
  subtitle: string;
  anchorDate: number;
  items: TimelineVideoItem[];
};

const TIMELINE_UNIT_LABELS: Record<TimelineUnit, string> = {
  day: "天",
  week: "周",
  month: "月",
};

const TIMELINE_VARIANTS: Record<
  TimelineVariant,
  {
    heroClassName: string;
    glowClassName: string;
    dotClassName: string;
    railClassName: string;
    activeItemClassName: string;
    activeDotClassName: string;
    badgeClassName: string;
    panelClassName: string;
    panelBarClassName: string;
    panelGlowClassName: string;
  }
> = {
  saved: {
    heroClassName:
      "border-amber-500/20 bg-[linear-gradient(135deg,rgba(251,191,36,0.16),rgba(249,115,22,0.08)_42%,rgba(244,63,94,0.12))]",
    glowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.28),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,0.18),transparent_36%)]",
    dotClassName: "border-amber-200/60 bg-amber-400 shadow-[0_0_0_6px_rgba(251,191,36,0.14)]",
    railClassName: "bg-gradient-to-b from-amber-300 via-orange-400 to-rose-400",
    activeItemClassName:
      "border-amber-400/30 bg-amber-500/12 text-foreground shadow-[0_16px_40px_-24px_rgba(251,191,36,0.55)]",
    activeDotClassName: "border-amber-100 bg-amber-300",
    badgeClassName:
      "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-200",
    panelClassName:
      "border-amber-500/15 bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,0.72))] dark:bg-[linear-gradient(180deg,rgba(41,37,36,0.9),rgba(24,24,27,0.88))]",
    panelBarClassName: "bg-gradient-to-b from-amber-300 via-orange-400 to-rose-400",
    panelGlowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(251,113,133,0.14),transparent_35%)]",
  },
  "watch-later": {
    heroClassName:
      "border-cyan-500/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(14,165,233,0.08)_42%,rgba(59,130,246,0.12))]",
    glowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.26),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_36%)]",
    dotClassName: "border-cyan-200/60 bg-cyan-400 shadow-[0_0_0_6px_rgba(34,211,238,0.12)]",
    railClassName: "bg-gradient-to-b from-cyan-300 via-sky-400 to-blue-500",
    activeItemClassName:
      "border-cyan-400/30 bg-cyan-500/12 text-foreground shadow-[0_16px_40px_-24px_rgba(34,211,238,0.52)]",
    activeDotClassName: "border-cyan-100 bg-cyan-300",
    badgeClassName:
      "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
    panelClassName:
      "border-cyan-500/15 bg-[linear-gradient(180deg,rgba(236,254,255,0.92),rgba(255,255,255,0.72))] dark:bg-[linear-gradient(180deg,rgba(22,78,99,0.34),rgba(24,24,27,0.88))]",
    panelBarClassName: "bg-gradient-to-b from-cyan-300 via-sky-400 to-blue-500",
    panelGlowClassName:
      "bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_35%)]",
  },
};

function startOfWeek(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - day);
  return value;
}

function getWeekMeta(date: Date) {
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  target.setDate(target.getDate() + 3 - ((target.getDay() + 6) % 7));
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const weekNumber =
    1 +
    Math.round(
      ((target.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getDay() + 6) % 7)) /
        7
    );

  return {
    week: weekNumber,
    year: target.getFullYear(),
  };
}

function formatDayTitle(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatTimelineStamp(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getTimelineGroupMeta(date: Date, unit: TimelineUnit) {
  const base = new Date(date);
  base.setHours(0, 0, 0, 0);

  if (unit === "month") {
    const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
    return {
      id: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, "0")}`,
      title: `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`,
      navLabel: `${monthStart.getMonth() + 1}月`,
      subtitle: `从 ${formatMonthDay(monthStart)} 开始`,
      anchorDate: monthStart.getTime(),
    };
  }

  if (unit === "week") {
    const weekStart = startOfWeek(base);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const { year, week } = getWeekMeta(weekStart);

    return {
      id: `${year}-W${String(week).padStart(2, "0")}`,
      title: `${year} 第 ${week} 周`,
      navLabel: `W${week}`,
      subtitle: `${formatMonthDay(weekStart)} - ${formatMonthDay(weekEnd)}`,
      anchorDate: weekStart.getTime(),
    };
  }

  return {
    id: `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}-${String(base.getDate()).padStart(2, "0")}`,
    title: formatDayTitle(base),
    navLabel: `${base.getMonth() + 1}/${base.getDate()}`,
    subtitle: `${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][base.getDay()]} · ${formatRelativeTime(base)}`,
    anchorDate: base.getTime(),
  };
}

function groupTimelineVideos(videos: TimelineVideoItem[], unit: TimelineUnit) {
  const sortedVideos = [...videos].sort((a, b) => {
    return (
      new Date(b.timelineAt).getTime() -
      new Date(a.timelineAt).getTime()
    );
  });

  const groupMap = new Map<string, TimelineGroup>();

  for (const video of sortedVideos) {
    const timelineDate = new Date(video.timelineAt);

    if (Number.isNaN(timelineDate.getTime())) {
      continue;
    }

    const meta = getTimelineGroupMeta(timelineDate, unit);
    const group = groupMap.get(meta.id);

    if (group) {
      group.items.push(video);
      continue;
    }

    groupMap.set(meta.id, {
      ...meta,
      items: [video],
    });
  }

  return [...groupMap.values()].sort((a, b) => b.anchorDate - a.anchorDate);
}

export function VideoTimeline({
  title,
  description,
  videos,
  emptyState,
  variant = "saved",
  timelineLabel = "加入时间",
}: {
  title: string;
  description: string;
  videos: TimelineVideoItem[];
  emptyState: string;
  variant?: TimelineVariant;
  timelineLabel?: string;
}) {
  const palette = TIMELINE_VARIANTS[variant];
  const [unit, setUnit] = useState<TimelineUnit>("day");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navRailRef = useRef<HTMLDivElement | null>(null);
  const navProgressRef = useRef<HTMLDivElement | null>(null);
  const heroGlowRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const groups = useMemo(() => groupTimelineVideos(videos, unit), [unit, videos]);
  const latestAnchorDate = groups[0]?.anchorDate ?? null;

  useEffect(() => {
    setActiveGroupId(groups[0]?.id ?? null);
  }, [groups]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root || groups.length === 0) {
      return;
    }

    const ctx = gsap.context(() => {
      const sections = groups
        .map((group) => sectionRefs.current[group.id])
        .filter((section): section is HTMLElement => Boolean(section));

      sections.forEach((section) => {
        const panel = section.querySelector<HTMLElement>("[data-timeline-panel]");
        const cards = section.querySelectorAll<HTMLElement>("[data-timeline-video]");
        const sectionId = section.dataset.groupId ?? null;

        if (panel) {
          gsap.fromTo(
            panel,
            {
              autoAlpha: 0,
              y: 42,
              scale: 0.985,
              filter: "blur(12px)",
            },
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              filter: "blur(0px)",
              duration: 0.72,
              ease: "power3.out",
              scrollTrigger: {
                trigger: section,
                start: "top bottom-=120",
                once: true,
              },
            }
          );
        }

        if (cards.length > 0) {
          gsap.fromTo(
            cards,
            {
              autoAlpha: 0,
              y: 18,
            },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.46,
              ease: "power2.out",
              stagger: 0.05,
              scrollTrigger: {
                trigger: section,
                start: "top bottom-=80",
                once: true,
              },
            }
          );
        }

        ScrollTrigger.create({
          trigger: section,
          start: "top center+=40",
          end: "bottom center",
          onEnter: () => {
            setActiveGroupId((current) =>
              current === sectionId ? current : sectionId
            );
          },
          onEnterBack: () => {
            setActiveGroupId((current) =>
              current === sectionId ? current : sectionId
            );
          },
        });
      });

      if (navProgressRef.current) {
        gsap.fromTo(
          navProgressRef.current,
          {
            scaleY: 0,
            transformOrigin: "top center",
          },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: root,
              start: "top top+=110",
              end: "bottom bottom-=140",
              scrub: true,
            },
          }
        );
      }

      if (heroGlowRef.current) {
        gsap.to(heroGlowRef.current, {
          yPercent: 18,
          ease: "none",
          scrollTrigger: {
            trigger: root,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        });
      }

      if (navRailRef.current) {
        gsap.fromTo(
          navRailRef.current,
          {
            autoAlpha: 0,
            x: -18,
          },
          {
            autoAlpha: 1,
            x: 0,
            duration: 0.55,
            ease: "power3.out",
          }
        );
      }
    }, root);

    return () => {
      ctx.revert();
    };
  }, [groups]);

  const scrollToGroup = (groupId: string) => {
    const section = sectionRefs.current[groupId];

    if (!section) {
      return;
    }

    const top = section.getBoundingClientRect().top + window.scrollY - 104;
    window.scrollTo({
      top,
      behavior: "smooth",
    });
    setActiveGroupId(groupId);
  };

  return (
    <div ref={rootRef} className="space-y-6">
      <section
        className={cn(
          "relative overflow-hidden rounded-[2rem] border px-5 py-6 shadow-[0_24px_80px_-56px_rgba(15,23,42,0.5)] backdrop-blur-sm sm:px-7",
          palette.heroClassName
        )}
        data-home-animate
      >
        <div
          ref={heroGlowRef}
          aria-hidden="true"
          className={cn("absolute inset-0 opacity-90", palette.glowClassName)}
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <Sparkles className="size-3.5" />
                Timeline
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 className="size-3.5" />
                默认按天展开
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              {description}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                  palette.badgeClassName
                )}
              >
                <Layers3 className="size-3.5" />
                {groups.length} 个时间节点
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                  palette.badgeClassName
                )}
              >
                <CalendarRange className="size-3.5" />
                {videos.length} 个视频
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {latestAnchorDate ? (
                <p className="text-xs text-muted-foreground">
                  最新节点更新于 {formatRelativeTime(latestAnchorDate)}
                </p>
              ) : null}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full border-white/30 bg-background/60 px-4 backdrop-blur-sm"
                  >
                    按{TIMELINE_UNIT_LABELS[unit]}查看
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-40 rounded-2xl border-white/20 bg-background/90 p-2 backdrop-blur-xl"
                >
                  <DropdownMenuLabel>时间粒度</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuRadioGroup
                    value={unit}
                    onValueChange={(value) => setUnit(value as TimelineUnit)}
                  >
                    <DropdownMenuRadioItem value="day">
                      按天
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="week">
                      按周
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="month">
                      按月
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </section>

      {groups.length > 0 ? (
        <div className="grid gap-6 xl:grid-cols-[16rem_minmax(0,1fr)]">
          <aside
            ref={navRailRef}
            className="hidden xl:block"
            data-home-animate
          >
            <div className="sticky top-24 rounded-[2rem] border border-border/60 bg-background/78 p-5 shadow-[0_24px_60px_-48px_rgba(15,23,42,0.6)] backdrop-blur-xl">
              <div className="mb-5">
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  时间节点
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  点击任意节点，直接跳到对应的视频分组。
                </p>
              </div>

              <div className="relative pl-6">
                <div className="absolute left-[0.72rem] top-2 bottom-2 w-px bg-border/80" />
                <div
                  ref={navProgressRef}
                  className={cn(
                    "absolute left-[0.72rem] top-2 bottom-2 w-px origin-top rounded-full",
                    palette.railClassName
                  )}
                />
                <div className="space-y-3">
                  {groups.map((group) => {
                    const isActive = group.id === activeGroupId;

                    return (
                      <button
                        key={group.id}
                        type="button"
                        onClick={() => scrollToGroup(group.id)}
                        className={cn(
                          "relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition duration-200 hover:border-border/70 hover:bg-muted/50",
                          isActive && palette.activeItemClassName
                        )}
                      >
                        <span
                          className={cn(
                            "absolute left-[-0.03rem] top-1/2 size-3 -translate-y-1/2 rounded-full border-2 bg-background transition duration-200",
                            palette.dotClassName,
                            isActive && palette.activeDotClassName
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {group.navLabel}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {group.items.length} 个视频
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
              {groups.map((group) => {
                const isActive = group.id === activeGroupId;

                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => scrollToGroup(group.id)}
                    className={cn(
                      "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition duration-200",
                      isActive
                        ? palette.activeItemClassName
                        : "border-border/60 bg-background/70 hover:bg-muted/60"
                    )}
                  >
                    {group.navLabel}
                  </button>
                );
              })}
            </div>

            {groups.map((group) => (
              <section
                key={group.id}
                ref={(node) => {
                  sectionRefs.current[group.id] = node;
                }}
                data-group-id={group.id}
                className="relative scroll-mt-28"
              >
                <div
                  data-timeline-panel
                  className={cn(
                    "relative overflow-hidden rounded-[2rem] border px-5 py-5 shadow-[0_28px_70px_-54px_rgba(15,23,42,0.65)] backdrop-blur-sm sm:px-6 sm:py-6",
                    palette.panelClassName
                  )}
                >
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute inset-0 opacity-90",
                      palette.panelGlowClassName
                    )}
                  />
                  <div
                    aria-hidden="true"
                    className={cn(
                      "absolute left-0 top-0 h-full w-1.5",
                      palette.panelBarClassName
                    )}
                  />

                  <div className="relative">
                    <div className="flex flex-col gap-4 border-b border-border/50 pb-5 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          {TIMELINE_UNIT_LABELS[unit]}视图
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                          {group.title}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {group.subtitle}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                            palette.badgeClassName
                          )}
                        >
                          <Sparkles className="size-3.5" />
                          {group.items.length} 条内容
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-full"
                          onClick={() => scrollToGroup(group.id)}
                        >
                          锚定当前节点
                        </Button>
                      </div>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                      {group.items.map((video) => {
                        const timelineDate = new Date(video.timelineAt);

                        return (
                          <div
                            key={video.id}
                            data-timeline-video
                            className="space-y-2"
                          >
                            <VideoCard data={video} />
                            <p className="px-1 text-xs text-muted-foreground">
                              {timelineLabel}：{formatTimelineStamp(timelineDate)}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <div
          className="rounded-[2rem] border border-dashed border-border/70 bg-muted/20 px-8 py-16 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm"
          data-home-animate
        >
          {emptyState}
        </div>
      )}
    </div>
  );
}
