'use server'

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

export async function getVideoInfo(shortCode: string) {
  if (!shortCode) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  const currentUserId = session?.user?.id ?? null;

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
      processingStatus: true,
      userId: true,
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

  if (!video || video.deletedAt) notFound();

  const isOwner = currentUserId === video.userId;

  // 基于 Visibility 的访问控制（参考 YouTube）
  switch (video.visibility) {
    case "PUBLIC":
    case "UNLISTED":
      // 非所有者只能访问已处理完成的视频
      if (!isOwner && video.processingStatus !== "READY") notFound();
      break;
    case "PRIVATE":
    case "DRAFT":
      // 仅所有者可访问；未登录时重定向登录页（避免泄露视频存在性，返回 404）
      if (!isOwner) {
        if (!currentUserId) redirect(`/login?callbackUrl=/watch/${shortCode}`);
        notFound();
      }
      break;
  }

  let prevReaction = undefined

  const { channel, userId: _userId, ...v } = video;

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
    isOwner,
  };
}

export type GetVideoInfoResult = Awaited<ReturnType<typeof getVideoInfo>>;
export type VideoData = GetVideoInfoResult['videoData'];
export type ChannelData = GetVideoInfoResult['channelData'];