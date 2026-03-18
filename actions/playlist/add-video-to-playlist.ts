"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as z from "zod";

const addVideoToPlaylistSchema = z.object({
  playlistId: z.string().min(1),
  videoShortCode: z.string().min(1),
});

export async function addVideoToPlaylist(params: {
  playlistId: string;
  videoShortCode: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const parsed = addVideoToPlaylistSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, videoShortCode } = parsed.data;

  const playlist = await prisma.playlist.findUnique({
    where: {
      id: playlistId,
      ownerId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!playlist) throw new Error("播放列表不存在");

  const video = await prisma.video.findUnique({
    where: {
      shortCode: videoShortCode,
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!video) throw new Error("视频不存在");

  const existed = await prisma.playlistItem.findFirst({
    where: {
      playlistId,
      videoId: video.id,
    },
    select: {
      id: true,
    },
  });

  if (existed) throw new Error("该视频已在播放列表中");

  return prisma.$transaction(async (tx) => {
    const latestItem = await tx.playlistItem.findFirst({
      where: {
        playlistId,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });

    const nextPosition = (latestItem?.position ?? -1) + 1;

    const item = await tx.playlistItem.create({
      data: {
        playlistId,
        videoId: video.id,
        addedById: session.user.id,
        position: nextPosition,
      },
    });

    await tx.playlist.update({
      where: {
        id: playlistId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return item;
  });
}
