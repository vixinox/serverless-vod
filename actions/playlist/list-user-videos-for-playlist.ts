"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function listUserVideosForPlaylist(searchTerm?: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const where: Prisma.VideoWhereInput = {
    userId: session.user.id,
    deletedAt: null,
    ...(searchTerm
      ? {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
  };

  return prisma.video.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      shortCode: true,
      title: true,
      thumbnail: true,
      processingStatus: true,
      visibility: true,
      createdAt: true,
    },
    take: 200,
  });
}
