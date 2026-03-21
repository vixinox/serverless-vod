import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOptionalUserId } from "@/lib/server/auth-session";

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

export async function getDashboardSummary() {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login");
  }

  const channel = await prisma.channel.findUnique({
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

  if (!channel) {
    return {
      hasChannel: false,
      channel: null,
      summary: {
        subscribersCount: 0,
        viewsLast7Days: 0,
        totalVideos: 0,
      },
      recentVideos: [],
    };
  }

  const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [viewsAggregate, totalVideos, recentVideos] = await Promise.all([
    prisma.videoDailyStat.aggregate({
      where: {
        video: {
          channelId: channel.id,
        },
        date: {
          gte: sevenDaysAgo,
        },
      },
      _sum: {
        views: true,
      },
    }),
    prisma.video.count({
      where: {
        channelId: channel.id,
        deletedAt: null,
      },
    }),
    prisma.video.findMany({
      where: {
        channelId: channel.id,
        deletedAt: null,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 3,
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
    }),
  ]);

  return {
    hasChannel: true,
    channel,
    summary: {
      subscribersCount: channel.subscribersCount,
      viewsLast7Days: Number(viewsAggregate._sum.views ?? 0n),
      totalVideos,
    },
    recentVideos: recentVideos.map((video) => ({
      ...video,
      views: Number(video.views),
    })),
  };
}

export async function getChannelStats(days: number = 30) {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login");
  }

  const channel = await prisma.channel.findUnique({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
      name: true,
      subscribersCount: true,
    },
  });

  if (!channel) {
    return {
      hasChannel: false,
      channel: null,
      totals: {
        views: 0,
        watchTimeSeconds: 0,
        subscribersNet: 0,
        videosPublished: 0,
      },
      daily: [],
    };
  }

  const range = enumerateDays(days);
  const rangeStart = range[0];

  const stats = await prisma.channelDailyStat.findMany({
    where: {
      channelId: channel.id,
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

  const daily = range.map((date) => {
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

  return {
    hasChannel: true,
    channel,
    totals: daily.reduce(
      (result, item) => ({
        views: result.views + item.views,
        watchTimeSeconds: result.watchTimeSeconds + item.watchTimeSeconds,
        subscribersNet: result.subscribersNet + item.subscribersGained - item.subscribersLost,
        videosPublished: result.videosPublished + item.videosPublished,
      }),
      {
        views: 0,
        watchTimeSeconds: 0,
        subscribersNet: 0,
        videosPublished: 0,
      },
    ),
    daily,
  };
}

export async function getVideoStats(days: number = 30) {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login");
  }

  const channel = await prisma.channel.findUnique({
    where: {
      ownerId: userId,
    },
    select: {
      id: true,
    },
  });

  if (!channel) {
    return {
      hasChannel: false,
      videos: [],
    };
  }

  const rangeStart = startOfDay(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));

  const [videos, stats] = await Promise.all([
    prisma.video.findMany({
      where: {
        channelId: channel.id,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        shortCode: true,
        thumbnail: true,
        views: true,
        likesCount: true,
        commentsCount: true,
        processingStatus: true,
        visibility: true,
        publishedAt: true,
        createdAt: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.videoDailyStat.groupBy({
      by: ["videoId"],
      where: {
        video: {
          channelId: channel.id,
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

  const statsByVideoId = new Map(stats.map((item) => [item.videoId, item]));

  return {
    hasChannel: true,
    videos: videos.map((video) => {
      const row = statsByVideoId.get(video.id);

      return {
        ...video,
        views: Number(video.views),
        viewsLastDays: Number(row?._sum.views ?? 0n),
        uniqueViewersLastDays: row?._sum.uniqueViewers ?? 0,
        watchTimeSecondsLastDays: Number(row?._sum.watchTimeSeconds ?? 0n),
        likesGainedLastDays: row?._sum.likesGained ?? 0,
        commentsGainedLastDays: row?._sum.commentsGained ?? 0,
        trackedDays: row?._count._all ?? 0,
      };
    }),
  };
}
