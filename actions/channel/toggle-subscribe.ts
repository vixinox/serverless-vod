'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function toggleSubscribe(channelId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("请先登录后再操作");
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (!channel) {
    throw new Error("频道不存在");
  }

  if (channel.ownerId === session.user.id) {
    return {
      isSubscribed: false,
    };
  }

  const existingSubscription = await prisma.subscription.findUnique({
    where: {
      subscriberId_channelId: {
        subscriberId: session.user.id,
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
          subscriberId: session.user.id,
          channelId,
        },
      },
    });

    return {
      isSubscribed: false,
    };
  }

  await prisma.subscription.create({
    data: {
      subscriberId: session.user.id,
      channelId,
    },
  });

  return {
    isSubscribed: true,
  };
}
