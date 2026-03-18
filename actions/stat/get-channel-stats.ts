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

export async function getChannelStats(days: number = 30) {
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

  const statsByDate = new Map(
    stats.map((item) => [toDateKey(item.date), item]),
  );

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
