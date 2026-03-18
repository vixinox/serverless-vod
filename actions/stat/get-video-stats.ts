'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getVideoStats(days: number = 30) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/login");
  }

  const channel = await prisma.channel.findUnique({
    where: {
      ownerId: session.user.id,
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
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
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

  const statsByVideoId = new Map(
    stats.map((item) => [item.videoId, item]),
  );

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
