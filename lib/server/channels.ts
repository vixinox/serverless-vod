import prisma from "@/lib/prisma";
import { requireUserId } from "@/lib/server/auth-session";

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
