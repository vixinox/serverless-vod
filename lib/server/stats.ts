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
  };
  trend30d: {
    date: Date;
    views: number;
    watchTimeHours: number;
    subscribersNet: number;
    subscribersGained: number;
    subscribersLost: number;
    videosPublished: number;
  }[];
  subscriberFlow30d: {
    date: Date;
    views: number;
    watchTimeHours: number;
    subscribersNet: number;
    subscribersGained: number;
    subscribersLost: number;
    videosPublished: number;
  }[];
  typeBreakdown: VideoTypeBreakdown[];
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
    commentsGained: number;
  };
  trend30d: {
    date: Date;
    views: number;
    uniqueViewers: number;
    watchTimeHours: number;
    likesGained: number;
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
    },
    trend30d: [],
    subscriberFlow30d: [],
    typeBreakdown: [],
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
      commentsGained: 0,
    },
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

async function loadVideoLeaderboard(channelId: string, days: number, take?: number) {
  const rangeStart = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const [videos, stats] = await Promise.all([
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
  ]);

  const videoById = new Map(videos.map((video) => [video.id, video]));

  const leaderboard = stats
    .map((item) => {
      const video = videoById.get(item.videoId);

      if (!video) {
        return null;
      }

      return {
        id: video.id,
        title: video.title,
        shortCode: video.shortCode,
        type: video.type as VideoTypeKey,
        viewsTotal: Number(video.views),
        viewsLastDays: Number(item._sum.views ?? 0n),
        uniqueViewersLastDays: item._sum.uniqueViewers ?? 0,
        watchTimeHoursLastDays: toHours(Number(item._sum.watchTimeSeconds ?? 0n)),
        likesGainedLastDays: item._sum.likesGained ?? 0,
        commentsGainedLastDays: item._sum.commentsGained ?? 0,
        trackedDays: item._count._all ?? 0,
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

  const [daily30, typeBreakdown, videoLeaderboard30d] = await Promise.all([
    loadChannelDaily(channel.id, 30),
    loadTypeBreakdown(channel.id),
    loadVideoLeaderboard(channel.id, 30),
  ]);

  const trend30d = daily30.map((item) => ({
    date: item.date,
    views: item.views,
    watchTimeHours: toHours(item.watchTimeSeconds),
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
    },
    trend30d,
    subscriberFlow30d: trend30d,
    typeBreakdown,
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

  const range = enumerateDays(30);
  const rangeStart = range[0];
  const dailyRows = await prisma.videoDailyStat.findMany({
    where: {
      videoId: video.id,
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
      uniqueViewers: true,
      watchTimeSeconds: true,
      likesGained: true,
      commentsGained: true,
    },
  });

  const dailyByDate = new Map(dailyRows.map((item) => [toDateKey(item.date), item]));
  const trend30d = range.map((date) => {
    const row = dailyByDate.get(toDateKey(date));

    return {
      date,
      views: Number(row?.views ?? 0n),
      uniqueViewers: row?.uniqueViewers ?? 0,
      watchTimeHours: toHours(Number(row?.watchTimeSeconds ?? 0n)),
      likesGained: row?.likesGained ?? 0,
      commentsGained: row?.commentsGained ?? 0,
    };
  });

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
      views: trend30d.reduce((result, item) => result + item.views, 0),
      uniqueViewers: trend30d.reduce((result, item) => result + item.uniqueViewers, 0),
      watchTimeHours: Number(
        trend30d.reduce((result, item) => result + item.watchTimeHours, 0).toFixed(1),
      ),
      likesGained: trend30d.reduce((result, item) => result + item.likesGained, 0),
      commentsGained: trend30d.reduce((result, item) => result + item.commentsGained, 0),
    },
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
