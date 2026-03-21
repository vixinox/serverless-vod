import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { getOptionalUserId, requireUserId } from "@/lib/server/auth-session";

export async function toggleSubscribe(channelId: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      ownerId: true,
      subscribersCount: true,
    },
  });

  if (!channel) {
    throw new Error("频道不存在");
  }

  if (channel.ownerId === userId) {
    return {
      isSubscribed: false,
      subscribersCount: channel.subscribersCount,
    };
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      subscriberId_channelId: {
        subscriberId: userId,
        channelId,
      },
    },
    select: {
      id: true,
    },
  });

  if (existingSubscription) {
    await prisma.subscription.delete({
      where: {
        subscriberId_channelId: {
          subscriberId: userId,
          channelId,
        },
      },
    });

    return {
      isSubscribed: false,
      subscribersCount: Math.max(0, channel.subscribersCount - 1),
    };
  }

  await prisma.subscription.create({
    data: {
      subscriberId: userId,
      channelId,
    },
  });

  return {
    isSubscribed: true,
    subscribersCount: channel.subscribersCount + 1,
  };
}

export async function getChannelPageData(channelName: string) {
  const safeChannelName = decodeURIComponent(channelName).trim();

  if (!safeChannelName) {
    notFound();
  }

  const currentUserId = await getOptionalUserId();

  const channel = await prisma.channel.findUnique({
    where: {
      name: safeChannelName,
    },
    select: {
      id: true,
      name: true,
      banner: true,
      description: true,
      subscribersCount: true,
      createdAt: true,
      ownerId: true,
      owner: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });

  if (!channel) {
    notFound();
  }

  const isOwner = currentUserId === channel.ownerId;

  const [subscription, videoTotals, videos] = await Promise.all([
    currentUserId
      ? prisma.subscription.findUnique({
          where: {
            subscriberId_channelId: {
              subscriberId: currentUserId,
              channelId: channel.id,
            },
          },
          select: {
            id: true,
          },
        })
      : null,
    prisma.video.aggregate({
      where: {
        channelId: channel.id,
        deletedAt: null,
        visibility: "PUBLIC",
        processingStatus: "READY",
      },
      _count: {
        id: true,
      },
      _sum: {
        views: true,
      },
    }),
    prisma.video.findMany({
      where: {
        channelId: channel.id,
        deletedAt: null,
        visibility: "PUBLIC",
        processingStatus: "READY",
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 48,
      select: {
        id: true,
        shortCode: true,
        title: true,
        description: true,
        views: true,
        thumbnail: true,
        type: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    channel: {
      id: channel.id,
      name: channel.name,
      banner: channel.banner ?? "",
      description: channel.description ?? "",
      subscribersCount: channel.subscribersCount,
      createdAt: channel.createdAt,
      owner: channel.owner,
      isSubscribed: Boolean(subscription),
      isOwner,
      publicVideosCount: videoTotals._count.id,
      totalViews: Number(videoTotals._sum.views ?? 0),
    },
    videos: videos.map((video) => ({
      id: video.id,
      shortCode: video.shortCode,
      title: video.title,
      description: video.description ?? "",
      views: Number(video.views),
      thumbnail: video.thumbnail ?? "",
      type: video.type,
      createdAt: video.createdAt,
      ownerName: channel.name,
      ownerImage: channel.owner.image ?? "",
    })),
  };
}

export type ChannelPageData = Awaited<ReturnType<typeof getChannelPageData>>;
