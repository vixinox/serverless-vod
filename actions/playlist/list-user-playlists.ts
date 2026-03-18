"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

interface ListUserPlaylistsParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
}

export async function listUserPlaylists(params: ListUserPlaylistsParams) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const { page, pageSize, searchTerm = "" } = params;
  const skip = (page - 1) * pageSize;

  const where: Prisma.PlaylistWhereInput = {
    ownerId: session.user.id,
    ...(searchTerm
      ? {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
  };

  const [playlists, totalCount] = await Promise.all([
    prisma.playlist.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    prisma.playlist.count({ where }),
  ]);

  return {
    playlists,
    totalCount,
  };
}
