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

export async function getDashboardSummary() {
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
      orderBy: [
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
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
