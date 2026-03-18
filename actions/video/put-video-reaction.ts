'use server';

import { headers } from "next/headers";
import { ReactionType } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function putVideoReaction(videoId: string, reactionType?: ReactionType) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("请先登录后再操作");
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!video || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const existingReaction = await prisma.videoReaction.findUnique({
    where: {
      userId_videoId: {
        userId: session.user.id,
        videoId,
      },
    },
    select: {
      reactionType: true,
    },
  });

  if (!reactionType || existingReaction?.reactionType === reactionType) {
    await prisma.videoReaction.deleteMany({
      where: {
        userId: session.user.id,
        videoId,
      },
    });

    return {
      reaction: undefined,
    };
  }

  await prisma.videoReaction.upsert({
    where: {
      userId_videoId: {
        userId: session.user.id,
        videoId,
      },
    },
    create: {
      userId: session.user.id,
      videoId,
      reactionType,
    },
    update: {
      reactionType,
    },
  });

  return {
    reaction: reactionType,
  };
}
