"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as z from "zod";

const removeVideoFromPlaylistSchema = z.object({
  playlistId: z.string().min(1),
  videoId: z.string().min(1),
});

export async function removeVideoFromPlaylist(params: {
  playlistId: string;
  videoId: string;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const parsed = removeVideoFromPlaylistSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, videoId } = parsed.data;

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

  const item = await prisma.playlistItem.findFirst({
    where: {
      playlistId,
      videoId,
    },
    select: {
      id: true,
      position: true,
    },
  });

  if (!item) throw new Error("播放列表中不存在该视频");

  await prisma.$transaction([
    prisma.playlistItem.delete({
      where: {
        id: item.id,
      },
    }),
    prisma.playlistItem.updateMany({
      where: {
        playlistId,
        position: {
          gt: item.position,
        },
      },
      data: {
        position: {
          decrement: 1,
        },
      },
    }),
    prisma.playlist.update({
      where: {
        id: playlistId,
      },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);
}
