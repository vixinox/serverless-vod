'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  QUICK_SAVE_PLAYLIST_DESCRIPTION,
  QUICK_SAVE_PLAYLIST_TITLE,
} from "@/lib/system-playlists";

export async function toggleVideoSave(videoId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    throw new Error("请先登录后再操作");
  }

  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: {
      id: true,
      userId: true,
      deletedAt: true,
      visibility: true,
      processingStatus: true,
    },
  });

  if (!video || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const canSave =
    video.userId === session.user.id ||
    (
      (video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
      video.processingStatus === "READY"
    );

  if (!canSave) {
    throw new Error("该视频当前不可收藏");
  }

  return prisma.$transaction(async (tx) => {
    let playlist = await tx.playlist.findFirst({
      where: {
        ownerId: session.user.id,
        title: QUICK_SAVE_PLAYLIST_TITLE,
        description: QUICK_SAVE_PLAYLIST_DESCRIPTION,
        isPublic: false,
      },
      select: {
        id: true,
        title: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (!playlist) {
      playlist = await tx.playlist.create({
        data: {
          ownerId: session.user.id,
          title: QUICK_SAVE_PLAYLIST_TITLE,
          description: QUICK_SAVE_PLAYLIST_DESCRIPTION,
          isPublic: false,
        },
        select: {
          id: true,
          title: true,
        },
      });
    }

    const existingItem = await tx.playlistItem.findFirst({
      where: {
        playlistId: playlist.id,
        videoId,
      },
      select: {
        id: true,
        position: true,
      },
    });

    if (existingItem) {
      await tx.playlistItem.delete({
        where: {
          id: existingItem.id,
        },
      });

      await tx.playlistItem.updateMany({
        where: {
          playlistId: playlist.id,
          position: {
            gt: existingItem.position,
          },
        },
        data: {
          position: {
            decrement: 1,
          },
        },
      });

      await tx.playlist.update({
        where: {
          id: playlist.id,
        },
        data: {
          updatedAt: new Date(),
        },
      });

      return {
        saved: false,
        playlistId: playlist.id,
        playlistTitle: playlist.title,
      };
    }

    const latestItem = await tx.playlistItem.findFirst({
      where: {
        playlistId: playlist.id,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });

    await tx.playlistItem.create({
      data: {
        playlistId: playlist.id,
        videoId,
        addedById: session.user.id,
        position: (latestItem?.position ?? -1) + 1,
      },
    });

    await tx.playlist.update({
      where: {
        id: playlist.id,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return {
      saved: true,
      playlistId: playlist.id,
      playlistTitle: playlist.title,
    };
  });
}
