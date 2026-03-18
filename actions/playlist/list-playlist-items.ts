"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function listPlaylistItems(playlistId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

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

  return prisma.playlistItem.findMany({
    where: {
      playlistId,
      video: {
        deletedAt: null,
      },
    },
    orderBy: {
      position: "asc",
    },
    select: {
      id: true,
      position: true,
      video: {
        select: {
          id: true,
          shortCode: true,
          title: true,
          thumbnail: true,
          processingStatus: true,
          visibility: true,
        },
      },
    },
  });
}
