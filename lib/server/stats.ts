import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/server/auth-session";

const VIDEO_TYPES = ["LONG", "SHORT"] as const;

type VideoTypeKey = (typeof VIDEO_TYPES)[number];

type ChannelSummary = {
  id: string;
  name: string;
  subscribersCount: number;
  description: string | null;
};

type ChannelDailyPoint = {
  date: Date;
  views: number;
  watchTimeSeconds: number;
  subscribersGained: number;
  subscribersLost: number;
  videosPublished: number;
};

export type VideoTypeBreakdown = {
  type: VideoTypeKey;
  count: number;
  views: number;
};

type MetricDelta = {
  current: number;
  previous: number;
  changePercent: number | null;
};

type DiagnosticTone = "up" | "flat" | "down" | "neutral";

type DiagnosticInsight = {
  title: string;
  value: string;
  tone: DiagnosticTone;
};

export type DashboardPageData = {
  hasChannel: boolean;
  channel: ChannelSummary | null;
  overview: {
    subscribersCount: number;
    views7d: number;
    watchTimeHours7d: number;
    videosPublished7d: number;
    totalVideos: number;
  };
  trend14d: {
    date: Date;
    views: number;
  }[];
  typeBreakdown: VideoTypeBreakdown[];
  recentVideos: {
    id: string;
    title: string;
    shortCode: string;
    thumbnail: string | null;
    views: number;
    visibility: string;
    processingStatus: string;
    publishedAt: Date | null;
    createdAt: Date;
  }[];
  topVideos7d: {
    id: string;
    title: string;
    shortCode: string;
    viewsLast7d: number;
    likesGainedLast7d: number;
    commentsGainedLast7d: number;
  }[];
};

export type StatPageData = {
  hasChannel: boolean;
  channel: ChannelSummary | null;
  overview30d: {
    views: number;
    watchTimeHours: number;
    subscribersNet: number;
    videosPublished: number;
    averageViewSeconds: number;
    subscriberPerThousandViews: number;
    averageViewsPerVideo: number;
  };
  comparison30d: {
    views: MetricDelta;
    averageViewSeconds: MetricDelta;
    subscribersNet: MetricDelta;
  };
  diagnostics: DiagnosticInsight[];
  trend30d: {
    date: Date;
    views: number;
    watchTimeHours: number;
    watchTimeSeconds: number;
    averageViewSeconds: number;
    rollingViews7d: number;
    subscriberPerThousandViews: number;
    subscribersNet: number;
    subscribersGained: number;
    subscribersLost: number;
    videosPublished: number;
  }[];
  subscriberFlow30d: {
    date: Date;
    views: number;
    watchTimeHours: number;
    watchTimeSeconds: number;
    averageViewSeconds: number;
    rollingViews7d: number;
    subscriberPerThousandViews: number;
    subscribersNet: number;
    subscribersGained: number;
    subscribersLost: number;
    videosPublished: number;
  }[];
  typeBreakdown: VideoTypeBreakdown[];
  contentTypePerformance: {
    type: VideoTypeKey;
    count: number;
    views: number;
    averageViews: number;
    watchTimeHours: number;
    averageViewSeconds: number;
  }[];
  videoLeaderboard30d: {
    id: string;
    title: string;
    shortCode: string;
    type: VideoTypeKey;
    viewsTotal: number;
    viewsLastDays: number;
    uniqueViewersLastDays: number;
    watchTimeHoursLastDays: number;
    likesGainedLastDays: number;
    commentsGainedLastDays: number;
    trackedDays: number;
    contributionPercent: number;
    averageViewSeconds: number;
    engagementRate: number;
    momentum7dPercent: number | null;
    label: string;
  }[];
};

export type VideoAnalyticsPageData = {
  hasVideo: boolean;
  channel: ChannelSummary | null;
  video: {
    id: string;
    title: string;
    shortCode: string;
    type: VideoTypeKey;
    visibility: string;
    processingStatus: string;
    publishedAt: Date | null;
    createdAt: Date;
    viewsTotal: number;
    likesCount: number;
    commentsCount: number;
    duration: number | null;
  } | null;
  overview30d: {
    views: number;
    uniqueViewers: number;
    watchTimeHours: number;
    likesGained: number;
    dislikesGained: number;
    commentsGained: number;
    averageViewSeconds: number;
    completionRate: number | null;
    engagementRate: number;
    feedbackRate: number;
    positiveRate: number | null;
    reactionsGained: number;
    commentsPerThousandViews: number;
    viewsPerViewer: number;
  };
  comparison: {
    views7d: MetricDelta;
    watchTimeSeconds7d: MetricDelta;
  };
  diagnostics: DiagnosticInsight[];
  trend30d: {
    date: Date;
    views: number;
    uniqueViewers: number;
    watchTimeHours: number;
    watchTimeSeconds: number;
    averageViewSeconds: number;
    completionRate: number | null;
    engagementRate: number;
    feedbackRate: number;
    positiveRate: number | null;
    likesGained: number;
    dislikesGained: number;
    reactionsGained: number;
    commentsGained: number;
  }[];
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function enumerateDays(days: number) {
  const today = startOfDay(new Date());

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return date;
  });
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toHours(seconds: number) {
  return Number((seconds / 3600).toFixed(1));
}

function round(value: number, digits = 1) {
  return Number(value.toFixed(digits));
}

function safeRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function safePercent(numerator: number, denominator: number) {
  return round(safeRatio(numerator, denominator) * 100);
}

function nullablePercent(numerator: number, denominator: number) {
  return denominator > 0 ? safePercent(numerator, denominator) : null;
}

function getMetricDelta(current: number, previous: number): MetricDelta {
  return {
    current,
    previous,
    changePercent: previous > 0 ? round(((current - previous) / previous) * 100) : null,
  };
}

function formatSignedPercent(value: number | null) {
  if (value === null) {
    return "新基线";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".0", "")}%`;
}

function formatCompactZh(value: number) {
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1).replace(".0", "")}亿`;
  }

  if (value >= 10000) {
    return `${(value / 10000).toFixed(1).replace(".0", "")}万`;
  }

  return Math.round(value).toLocaleString("zh-CN");
}

function formatSeconds(value: number) {
  if (value <= 0) {
    return "0 秒";
  }

  if (value < 60) {
    return `${Math.round(value)} 秒`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);

  return seconds > 0 ? `${minutes}分${seconds}秒` : `${minutes} 分钟`;
}

function sumChannelDaily(days: ChannelDailyPoint[]) {
  const views = days.reduce((result, item) => result + item.views, 0);
  const watchTimeSeconds = days.reduce((result, item) => result + item.watchTimeSeconds, 0);
  const subscribersNet = days.reduce(
    (result, item) => result + item.subscribersGained - item.subscribersLost,
    0,
  );
  const videosPublished = days.reduce((result, item) => result + item.videosPublished, 0);

  return {
    views,
    watchTimeSeconds,
    subscribersNet,
    videosPublished,
  };
}

function getRollingViews(days: ChannelDailyPoint[], index: number, windowSize: number) {
  const start = Math.max(0, index - windowSize + 1);
  const window = days.slice(start, index + 1);
  return Math.round(window.reduce((result, item) => result + item.views, 0) / window.length);
}

function getDiagnosticTone(delta: number | null): DiagnosticTone {
  if (delta === null) {
    return "neutral";
  }

  if (delta > 5) {
    return "up";
  }

  if (delta < -5) {
    return "down";
  }

  return "flat";
}

function getEmptyDashboardPageData(): DashboardPageData {
  return {
    hasChannel: false,
    channel: null,
    overview: {
      subscribersCount: 0,
      views7d: 0,
      watchTimeHours7d: 0,
      videosPublished7d: 0,
      totalVideos: 0,
    },
    trend14d: [],
    typeBreakdown: [],
    recentVideos: [],
    topVideos7d: [],
  };
}

function getEmptyStatPageData(): StatPageData {
  return {
    hasChannel: false,
    channel: null,
    overview30d: {
      views: 0,
      watchTimeHours: 0,
      subscribersNet: 0,
      videosPublished: 0,
      averageViewSeconds: 0,
      subscriberPerThousandViews: 0,
      averageViewsPerVideo: 0,
    },
    comparison30d: {
      views: getMetricDelta(0, 0),
      averageViewSeconds: getMetricDelta(0, 0),
      subscribersNet: getMetricDelta(0, 0),
    },
    diagnostics: [],
    trend30d: [],
    subscriberFlow30d: [],
    typeBreakdown: [],
    contentTypePerformance: [],
    videoLeaderboard30d: [],
  };
}

function getEmptyVideoAnalyticsPageData(): VideoAnalyticsPageData {
  return {
    hasVideo: false,
    channel: null,
    video: null,
    overview30d: {
      views: 0,
      uniqueViewers: 0,
      watchTimeHours: 0,
      likesGained: 0,
      dislikesGained: 0,
      commentsGained: 0,
      averageViewSeconds: 0,
      completionRate: null,
      engagementRate: 0,
      feedbackRate: 0,
      positiveRate: null,
      reactionsGained: 0,
      commentsPerThousandViews: 0,
      viewsPerViewer: 0,
    },
    comparison: {
      views7d: getMetricDelta(0, 0),
      watchTimeSeconds7d: getMetricDelta(0, 0),
    },
    diagnostics: [],
    trend30d: [],
  };
}

async function requireUserId() {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login");
  }

  return userId;
}

async function getCurrentChannel(userId: string): Promise<ChannelSummary | null> {
  return prisma.channel.findUnique({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
      subscribersCount: true,
      description: true,
    },
  });
}

async function loadChannelDaily(channelId: string, days: number): Promise<ChannelDailyPoint[]> {
  const range = enumerateDays(days);
  const rangeStart = range[0];

  const stats = await prisma.channelDailyStat.findMany({
    where: {
      channelId,
      date: {
        gte: rangeStart,
      },
    },
    orderBy: {
      date: "asc",
    },
    select: {
      date: true,
      views: true,
      watchTimeSeconds: true,
      subscribersGained: true,
      subscribersLost: true,
      videosPublished: true,
    },
  });

  const statsByDate = new Map(stats.map((item) => [toDateKey(item.date), item]));

  return range.map((date) => {
    const row = statsByDate.get(toDateKey(date));

    return {
      date,
      views: Number(row?.views ?? 0n),
      watchTimeSeconds: Number(row?.watchTimeSeconds ?? 0n),
      subscribersGained: row?.subscribersGained ?? 0,
      subscribersLost: row?.subscribersLost ?? 0,
      videosPublished: row?.videosPublished ?? 0,
    };
  });
}

async function loadTypeBreakdown(channelId: string): Promise<VideoTypeBreakdown[]> {
  const stats = await prisma.video.groupBy({
    by: ["type"],
    where: {
      channelId,
      deletedAt: null,
    },
    _count: {
      _all: true,
    },
    _sum: {
      views: true,
    },
  });

  const statsByType = new Map(stats.map((item) => [item.type as VideoTypeKey, item]));

  return VIDEO_TYPES.map((type) => {
    const row = statsByType.get(type);

    return {
      type,
      count: row?._count._all ?? 0,
      views: Number(row?._sum.views ?? 0n),
    };
  }).filter((item) => item.count > 0);
}

async function loadRecentVideos(channelId: string, take: number) {
  const recentVideos = await prisma.video.findMany({
    where: {
      channelId,
      deletedAt: null,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
      id: true,
      title: true,
      shortCode: true,
      thumbnail: true,
      views: true,
      visibility: true,
      processingStatus: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return recentVideos.map((video) => ({
    ...video,
    visibility: video.visibility,
    processingStatus: video.processingStatus,
    views: Number(video.views),
  }));
}

async function loadContentTypePerformance(channelId: string, days: number) {
  const rangeStart = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const [typeBreakdown, dailyStats] = await Promise.all([
    loadTypeBreakdown(channelId),
    prisma.videoDailyStat.groupBy({
      by: ["videoId"],
      where: {
        video: {
          channelId,
          deletedAt: null,
        },
        date: {
          gte: rangeStart,
        },
      },
      _sum: {
        views: true,
        watchTimeSeconds: true,
      },
    }),
  ]);

  const videos = await prisma.video.findMany({
    where: {
      channelId,
      deletedAt: null,
    },
    select: {
      id: true,
      type: true,
    },
  });
  const typeByVideoId = new Map(videos.map((video) => [video.id, video.type as VideoTypeKey]));
  const totalsByType = new Map<VideoTypeKey, { views: number; watchTimeSeconds: number }>();

  for (const row of dailyStats) {
    const type = typeByVideoId.get(row.videoId);

    if (!type) {
      continue;
    }

    const current = totalsByType.get(type) ?? { views: 0, watchTimeSeconds: 0 };
    current.views += Number(row._sum.views ?? 0n);
    current.watchTimeSeconds += Number(row._sum.watchTimeSeconds ?? 0n);
    totalsByType.set(type, current);
  }

  return typeBreakdown.map((item) => {
    const totals = totalsByType.get(item.type) ?? { views: 0, watchTimeSeconds: 0 };

    return {
      type: item.type,
      count: item.count,
      views: totals.views,
      averageViews: Math.round(safeRatio(totals.views, item.count)),
      watchTimeHours: toHours(totals.watchTimeSeconds),
      averageViewSeconds: Math.round(safeRatio(totals.watchTimeSeconds, totals.views)),
    };
  });
}

async function loadVideoLeaderboard(channelId: string, days: number, take?: number) {
  const rangeStart = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  const current7Start = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const previous7Start = startOfDay(new Date(Date.now() - 13 * 24 * 60 * 60 * 1000));

  const [videos, stats, current7Stats, previous7Stats] = await Promise.all([
    prisma.video.findMany({
      where: {
        channelId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        shortCode: true,
        views: true,
        type: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.videoDailyStat.groupBy({
      by: ["videoId"],
      where: {
        video: {
          channelId,
        },
        date: {
          gte: rangeStart,
        },
      },
      _sum: {
        views: true,
        uniqueViewers: true,
        watchTimeSeconds: true,
        likesGained: true,
        commentsGained: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.videoDailyStat.groupBy({
      by: ["videoId"],
      where: {
        video: {
          channelId,
        },
        date: {
          gte: current7Start,
        },
      },
      _sum: {
        views: true,
      },
    }),
    prisma.videoDailyStat.groupBy({
      by: ["videoId"],
      where: {
        video: {
          channelId,
        },
        date: {
          gte: previous7Start,
          lt: current7Start,
        },
      },
      _sum: {
        views: true,
      },
    }),
  ]);

  const videoById = new Map(videos.map((video) => [video.id, video]));
  const current7ByVideoId = new Map(current7Stats.map((item) => [item.videoId, Number(item._sum.views ?? 0n)]));
  const previous7ByVideoId = new Map(previous7Stats.map((item) => [item.videoId, Number(item._sum.views ?? 0n)]));
  const totalViewsLastDays = stats.reduce((result, item) => result + Number(item._sum.views ?? 0n), 0);

  const leaderboard = stats
    .map((item) => {
      const video = videoById.get(item.videoId);

      if (!video) {
        return null;
      }

      const viewsLastDays = Number(item._sum.views ?? 0n);
      const watchTimeSecondsLastDays = Number(item._sum.watchTimeSeconds ?? 0n);
      const likesGainedLastDays = item._sum.likesGained ?? 0;
      const commentsGainedLastDays = item._sum.commentsGained ?? 0;
      const current7Views = current7ByVideoId.get(item.videoId) ?? 0;
      const previous7Views = previous7ByVideoId.get(item.videoId) ?? 0;
      const engagementRate = safePercent(likesGainedLastDays + commentsGainedLastDays, viewsLastDays);
      const averageViewSeconds = Math.round(safeRatio(watchTimeSecondsLastDays, viewsLastDays));
      const momentum7dPercent = previous7Views > 0
        ? round(((current7Views - previous7Views) / previous7Views) * 100)
        : current7Views > 0
          ? null
          : 0;
      const contributionPercent = safePercent(viewsLastDays, totalViewsLastDays);
      const label =
        contributionPercent >= 35
          ? "拉新主力"
          : momentum7dPercent !== null && momentum7dPercent > 25
            ? "近期回升"
            : engagementRate >= 8
              ? "互动强"
              : averageViewSeconds >= 180
                ? "观看质量高"
                : "稳定观察";

      return {
        id: video.id,
        title: video.title,
        shortCode: video.shortCode,
        type: video.type as VideoTypeKey,
        viewsTotal: Number(video.views),
        viewsLastDays,
        uniqueViewersLastDays: item._sum.uniqueViewers ?? 0,
        watchTimeHoursLastDays: toHours(watchTimeSecondsLastDays),
        likesGainedLastDays,
        commentsGainedLastDays,
        trackedDays: item._count._all ?? 0,
        contributionPercent,
        averageViewSeconds,
        engagementRate,
        momentum7dPercent,
        label,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.viewsLastDays - left.viewsLastDays);

  return typeof take === "number" ? leaderboard.slice(0, take) : leaderboard;
}

export async function getDashboardPageData(): Promise<DashboardPageData> {
  const userId = await requireUserId();
  const channel = await getCurrentChannel(userId);

  if (!channel) {
    return getEmptyDashboardPageData();
  }

  const [daily14, typeBreakdown, recentVideos, topVideos7d] = await Promise.all([
    loadChannelDaily(channel.id, 14),
    loadTypeBreakdown(channel.id),
    loadRecentVideos(channel.id, 3),
    loadVideoLeaderboard(channel.id, 7, 5),
  ]);

  const last7Days = daily14.slice(-7);
  const totalVideos = typeBreakdown.reduce((result, item) => result + item.count, 0);

  return {
    hasChannel: true,
    channel,
    overview: {
      subscribersCount: channel.subscribersCount,
      views7d: last7Days.reduce((result, item) => result + item.views, 0),
      watchTimeHours7d: toHours(last7Days.reduce((result, item) => result + item.watchTimeSeconds, 0)),
      videosPublished7d: last7Days.reduce((result, item) => result + item.videosPublished, 0),
      totalVideos,
    },
    trend14d: daily14.map((item) => ({
      date: item.date,
      views: item.views,
    })),
    typeBreakdown,
    recentVideos,
    topVideos7d: topVideos7d.map((video) => ({
      id: video.id,
      title: video.title,
      shortCode: video.shortCode,
      viewsLast7d: video.viewsLastDays,
      likesGainedLast7d: video.likesGainedLastDays,
      commentsGainedLast7d: video.commentsGainedLastDays,
    })),
  };
}

export async function getStatPageData(): Promise<StatPageData> {
  const userId = await requireUserId();
  const channel = await getCurrentChannel(userId);

  if (!channel) {
    return getEmptyStatPageData();
  }

  const [daily60, typeBreakdown, contentTypePerformance, videoLeaderboard30d] = await Promise.all([
    loadChannelDaily(channel.id, 60),
    loadTypeBreakdown(channel.id),
    loadContentTypePerformance(channel.id, 30),
    loadVideoLeaderboard(channel.id, 30),
  ]);
  const previous30 = daily60.slice(0, 30);
  const daily30 = daily60.slice(-30);
  const currentSummary = sumChannelDaily(daily30);
  const previousSummary = sumChannelDaily(previous30);
  const current7 = sumChannelDaily(daily30.slice(-7));
  const previous7 = sumChannelDaily(daily30.slice(-14, -7));
  const totalVideos = typeBreakdown.reduce((result, item) => result + item.count, 0);
  const views7dDelta = getMetricDelta(current7.views, previous7.views);
  const top3Contribution = videoLeaderboard30d
    .slice(0, 3)
    .reduce((result, item) => result + item.contributionPercent, 0);
  const bestType = contentTypePerformance
    .slice()
    .sort((left, right) => right.averageViews - left.averageViews)[0];
  const currentAverageViewSeconds = Math.round(safeRatio(currentSummary.watchTimeSeconds, currentSummary.views));
  const previousAverageViewSeconds = Math.round(safeRatio(previousSummary.watchTimeSeconds, previousSummary.views));

  const trend30d = daily30.map((item, index) => ({
    date: item.date,
    views: item.views,
    watchTimeHours: toHours(item.watchTimeSeconds),
    watchTimeSeconds: item.watchTimeSeconds,
    averageViewSeconds: Math.round(safeRatio(item.watchTimeSeconds, item.views)),
    rollingViews7d: getRollingViews(daily30, index, 7),
    subscriberPerThousandViews: round(safeRatio(item.subscribersGained - item.subscribersLost, item.views) * 1000, 2),
    subscribersNet: item.subscribersGained - item.subscribersLost,
    subscribersGained: item.subscribersGained,
    subscribersLost: item.subscribersLost,
    videosPublished: item.videosPublished,
  }));

  return {
    hasChannel: true,
    channel,
    overview30d: {
      views: daily30.reduce((result, item) => result + item.views, 0),
      watchTimeHours: toHours(daily30.reduce((result, item) => result + item.watchTimeSeconds, 0)),
      subscribersNet: daily30.reduce(
        (result, item) => result + item.subscribersGained - item.subscribersLost,
        0,
      ),
      videosPublished: daily30.reduce((result, item) => result + item.videosPublished, 0),
      averageViewSeconds: currentAverageViewSeconds,
      subscriberPerThousandViews: round(safeRatio(currentSummary.subscribersNet, currentSummary.views) * 1000, 2),
      averageViewsPerVideo: Math.round(safeRatio(currentSummary.views, totalVideos)),
    },
    comparison30d: {
      views: getMetricDelta(currentSummary.views, previousSummary.views),
      averageViewSeconds: getMetricDelta(currentAverageViewSeconds, previousAverageViewSeconds),
      subscribersNet: getMetricDelta(currentSummary.subscribersNet, previousSummary.subscribersNet),
    },
    diagnostics: [
      {
        title: "7 天动量",
        value: formatSignedPercent(views7dDelta.changePercent),
        tone: getDiagnosticTone(views7dDelta.changePercent),
      },
      {
        title: "Top3 贡献",
        value: `${top3Contribution.toFixed(1).replace(".0", "")}%`,
        tone: top3Contribution >= 70 ? "down" : top3Contribution >= 45 ? "flat" : "up",
      },
      {
        title: "更有效类型",
        value: bestType ? `${bestType.type === "LONG" ? "长视频" : "短视频"} ${formatCompactZh(bestType.averageViews)}/条` : "暂无",
        tone: bestType ? "up" : "neutral",
      },
    ],
    trend30d,
    subscriberFlow30d: trend30d,
    typeBreakdown,
    contentTypePerformance,
    videoLeaderboard30d,
  };
}

export async function getVideoAnalyticsPageData(shortCode: string): Promise<VideoAnalyticsPageData> {
  const userId = await requireUserId();
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    return getEmptyVideoAnalyticsPageData();
  }

  const [channel, video] = await Promise.all([
    getCurrentChannel(userId),
    prisma.video.findFirst({
      where: {
        shortCode: safeShortCode,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        shortCode: true,
        type: true,
        visibility: true,
        processingStatus: true,
        publishedAt: true,
        createdAt: true,
        views: true,
        likesCount: true,
        commentsCount: true,
        duration: true,
      },
    }),
  ]);

  if (!video) {
    return {
      ...getEmptyVideoAnalyticsPageData(),
      channel,
    };
  }

  const videoStartDate = startOfDay(video.publishedAt ?? video.createdAt);
  const today = startOfDay(new Date());
  const firstVisibleDate = startOfDay(new Date(Math.max(
    videoStartDate.getTime(),
    today.getTime() - 29 * 24 * 60 * 60 * 1000,
  )));
  const visibleDayCount = Math.max(
    1,
    Math.floor((today.getTime() - firstVisibleDate.getTime()) / (24 * 60 * 60 * 1000)) + 1,
  );
  const range = Array.from({ length: visibleDayCount }, (_, index) => {
    const date = new Date(firstVisibleDate);
    date.setDate(firstVisibleDate.getDate() + index);
    return date;
  });
  const previousRangeStart = startOfDay(new Date(firstVisibleDate));
  previousRangeStart.setDate(previousRangeStart.getDate() - visibleDayCount);
  const dailyRows = await prisma.videoDailyStat.findMany({
    where: {
      videoId: video.id,
      date: {
        gte: previousRangeStart,
      },
    },
    orderBy: {
      date: "asc",
    },
    select: {
      date: true,
      views: true,
      uniqueViewers: true,
      watchTimeSeconds: true,
      likesGained: true,
      dislikesGained: true,
      commentsGained: true,
    },
  });

  const dailyByDate = new Map(dailyRows.map((item) => [toDateKey(item.date), item]));
  const buildDailyPoint = (date: Date) => {
    const row = dailyByDate.get(toDateKey(date));
    const views = Number(row?.views ?? 0n);
    const watchTimeSeconds = Number(row?.watchTimeSeconds ?? 0n);
    const averageViewSeconds = Math.round(safeRatio(watchTimeSeconds, views));
    const likesGained = row?.likesGained ?? 0;
    const dislikesGained = row?.dislikesGained ?? 0;
    const commentsGained = row?.commentsGained ?? 0;
    const reactionsGained = likesGained + dislikesGained;

    return {
      date,
      views,
      uniqueViewers: row?.uniqueViewers ?? 0,
      watchTimeHours: toHours(watchTimeSeconds),
      watchTimeSeconds,
      averageViewSeconds,
      completionRate: video.duration ? safePercent(averageViewSeconds, video.duration) : null,
      engagementRate: safePercent(likesGained + commentsGained, views),
      feedbackRate: safePercent(reactionsGained + commentsGained, views),
      positiveRate: nullablePercent(likesGained, reactionsGained),
      likesGained,
      dislikesGained,
      reactionsGained,
      commentsGained,
    };
  };
  const previousRange = Array.from({ length: visibleDayCount }, (_, index) => {
    const date = new Date(previousRangeStart);
    date.setDate(previousRangeStart.getDate() + index);
    return date;
  });
  const previousTrend = previousRange.map(buildDailyPoint);
  const trend30d = range.map(buildDailyPoint);
  const current7 = trend30d.slice(-7);
  const previous7 = trend30d.slice(-14, -7);
  const overview30d = {
    views: trend30d.reduce((result, item) => result + item.views, 0),
    uniqueViewers: trend30d.reduce((result, item) => result + item.uniqueViewers, 0),
    watchTimeSeconds: trend30d.reduce((result, item) => result + item.watchTimeSeconds, 0),
    likesGained: trend30d.reduce((result, item) => result + item.likesGained, 0),
    dislikesGained: trend30d.reduce((result, item) => result + item.dislikesGained, 0),
    commentsGained: trend30d.reduce((result, item) => result + item.commentsGained, 0),
  };
  const views7d = current7.reduce((result, item) => result + item.views, 0);
  const previousViews7d = previous7.length > 0
    ? previous7.reduce((result, item) => result + item.views, 0)
    : previousTrend.slice(-7).reduce((result, item) => result + item.views, 0);
  const watchTimeSeconds7d = current7.reduce((result, item) => result + item.watchTimeSeconds, 0);
  const previousWatchTimeSeconds7d = previous7.length > 0
    ? previous7.reduce((result, item) => result + item.watchTimeSeconds, 0)
    : previousTrend.slice(-7).reduce((result, item) => result + item.watchTimeSeconds, 0);
  const averageViewSeconds = Math.round(safeRatio(overview30d.watchTimeSeconds, overview30d.views));
  const completionRate = video.duration ? safePercent(averageViewSeconds, video.duration) : null;
  const reactionsGained = overview30d.likesGained + overview30d.dislikesGained;
  const engagementRate = safePercent(overview30d.likesGained + overview30d.commentsGained, overview30d.views);
  const feedbackRate = safePercent(reactionsGained + overview30d.commentsGained, overview30d.views);
  const positiveRate = nullablePercent(overview30d.likesGained, reactionsGained);
  const views7dDelta = getMetricDelta(views7d, previousViews7d);
  return {
    hasVideo: true,
    channel,
    video: {
      id: video.id,
      title: video.title,
      shortCode: video.shortCode,
      type: video.type as VideoTypeKey,
      visibility: video.visibility,
      processingStatus: video.processingStatus,
      publishedAt: video.publishedAt,
      createdAt: video.createdAt,
      viewsTotal: Number(video.views),
      likesCount: video.likesCount,
      commentsCount: video.commentsCount,
      duration: video.duration,
    },
    overview30d: {
      views: overview30d.views,
      uniqueViewers: overview30d.uniqueViewers,
      watchTimeHours: toHours(overview30d.watchTimeSeconds),
      likesGained: overview30d.likesGained,
      dislikesGained: overview30d.dislikesGained,
      commentsGained: overview30d.commentsGained,
      averageViewSeconds,
      completionRate,
      engagementRate,
      feedbackRate,
      positiveRate,
      reactionsGained,
      commentsPerThousandViews: round(safeRatio(overview30d.commentsGained, overview30d.views) * 1000, 2),
      viewsPerViewer: round(safeRatio(overview30d.views, overview30d.uniqueViewers), 2),
    },
    comparison: {
      views7d: views7dDelta,
      watchTimeSeconds7d: getMetricDelta(watchTimeSeconds7d, previousWatchTimeSeconds7d),
    },
    diagnostics: [
      {
        title: "平均观看",
        value: formatSeconds(averageViewSeconds),
        tone: averageViewSeconds > 0 ? "up" : "neutral",
      },
      {
        title: "反馈率",
        value: `${feedbackRate.toFixed(1).replace(".0", "")}%`,
        tone: feedbackRate >= 8 ? "up" : feedbackRate >= 2 ? "flat" : "neutral",
      },
      {
        title: "好评率",
        value: positiveRate === null ? "暂无" : `${positiveRate.toFixed(1).replace(".0", "")}%`,
        tone: positiveRate === null ? "neutral" : positiveRate >= 90 ? "up" : positiveRate >= 70 ? "flat" : "down",
      },
    ],
    trend30d,
  };
}

export async function getDashboardSummary() {
  const dashboard = await getDashboardPageData();

  return {
    hasChannel: dashboard.hasChannel,
    channel: dashboard.channel,
    summary: {
      subscribersCount: dashboard.overview.subscribersCount,
      viewsLast7Days: dashboard.overview.views7d,
      totalVideos: dashboard.overview.totalVideos,
    },
    recentVideos: dashboard.recentVideos,
  };
}

export async function getChannelStats(days: number = 30) {
  const stats = await getStatPageData();
  const daily = (days === 30 ? stats.trend30d : stats.trend30d.slice(-days)).map((item) => ({
    date: item.date,
    views: item.views,
    watchTimeSeconds: Math.round(item.watchTimeHours * 3600),
    subscribersGained: item.subscribersGained,
    subscribersLost: item.subscribersLost,
    videosPublished: item.videosPublished,
  }));

  return {
    hasChannel: stats.hasChannel,
    channel: stats.channel,
    totals: {
      views: daily.reduce((result, item) => result + item.views, 0),
      watchTimeSeconds: daily.reduce((result, item) => result + item.watchTimeSeconds, 0),
      subscribersNet: daily.reduce(
        (result, item) => result + item.subscribersGained - item.subscribersLost,
        0,
      ),
      videosPublished: daily.reduce((result, item) => result + item.videosPublished, 0),
    },
    daily,
  };
}

export async function getVideoStats(days: number = 30) {
  const stats = await getStatPageData();
  const videos = (days === 30 ? stats.videoLeaderboard30d : stats.videoLeaderboard30d).map((video) => ({
    id: video.id,
    title: video.title,
    shortCode: video.shortCode,
    views: video.viewsTotal,
    viewsLastDays: video.viewsLastDays,
    uniqueViewersLastDays: video.uniqueViewersLastDays,
    watchTimeSecondsLastDays: Math.round(video.watchTimeHoursLastDays * 3600),
    likesGainedLastDays: video.likesGainedLastDays,
    commentsGainedLastDays: video.commentsGainedLastDays,
    trackedDays: video.trackedDays,
  }));

  return {
    hasChannel: stats.hasChannel,
    videos,
  };
}
