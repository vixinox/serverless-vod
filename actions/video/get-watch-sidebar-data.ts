'use server'

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function getWatchSidebarData(shortCode: string) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const currentUserId = session?.user?.id ?? null;

  const currentVideo = await prisma.video.findUnique({
    where: { shortCode },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!currentVideo) {
    return {
      playlist: null,
    };
  }

  const isOwner = currentUserId === currentVideo.userId;

  const playlist = await prisma.playlist.findFirst({
    where: {
      ownerId: currentVideo.userId,
      ...(isOwner ? {} : { isPublic: true }),
      items: {
        some: {
          videoId: currentVideo.id,
        },
      },
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      title: true,
      description: true,
      isPublic: true,
      updatedAt: true,
      owner: {
        select: {
          name: true,
          channel: {
            select: {
              name: true,
            },
          },
        },
      },
      items: {
        where: {
          video: isOwner
            ? {
                deletedAt: null,
              }
            : {
                deletedAt: null,
                visibility: "PUBLIC",
                processingStatus: "READY",
              },
        },
        orderBy: {
          position: "asc",
        },
        select: {
          position: true,
          video: {
            select: {
              id: true,
              shortCode: true,
              title: true,
              thumbnail: true,
              views: true,
              createdAt: true,
              visibility: true,
              processingStatus: true,
            },
          },
        },
      },
    },
  });

  const normalizedPlaylist = playlist
    ? {
        ...playlist,
        items: playlist.items.map((item) => ({
          position: item.position,
          video: {
            ...item.video,
            views: Number(item.video.views),
          },
        })),
      }
    : null;

  const hasCurrentVideo = normalizedPlaylist?.items.some((item) => item.video.shortCode === shortCode) ?? false;

  return {
    playlist: hasCurrentVideo ? normalizedPlaylist : null,
  };
}

export type WatchSidebarData = Awaited<ReturnType<typeof getWatchSidebarData>>;
