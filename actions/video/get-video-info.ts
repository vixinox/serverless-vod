'use server'

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";

export async function getVideoInfo(shortCode: string) {
  if (!shortCode) notFound();

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: {
      id: true,
      title: true,
      description: true,
      thumbnail: true,
      views: true,
      likesCount: true,
      commentsCount: true,
      createdAt: true,
      deletedAt: true,
      visibility: true,
      channel: {
        select: {
          id: true,
          name: true,
          subscribersCount: true,
          owner: {
            select: {
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });
  if (!video || video.deletedAt || video.visibility !== "PUBLIC") notFound();

  let prevReaction = undefined

  const { channel, ...v } = video;

  return {
    videoData: {
      ...v,
      thumbnail: v.thumbnail ?? "",
      views: v.views,
      likesCount: v.likesCount,
      commentsCount: v.commentsCount,
      prevReaction,
    },
    channelData: {
      id: channel.id,
      name: channel.name,
      subscribersCount: channel.subscribersCount,
      owner: channel.owner,
    },
  };
}

export type GetVideoInfoResult = Awaited<ReturnType<typeof getVideoInfo>>;
export type VideoData = GetVideoInfoResult['videoData'];
export type ChannelData = GetVideoInfoResult['channelData'];