'use server';

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function searchVideos(query: string, limit: number = 24) {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      visibility: "PUBLIC",
      processingStatus: "READY",
      OR: [
        {
          title: {
            contains: normalizedQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          description: {
            contains: normalizedQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          channel: {
            name: {
              contains: normalizedQuery,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ],
    },
    take: Math.min(Math.max(limit, 1), 48),
    orderBy: [
      { views: "desc" },
      { createdAt: "desc" },
    ],
    select: {
      id: true,
      shortCode: true,
      title: true,
      description: true,
      views: true,
      thumbnail: true,
      type: true,
      createdAt: true,
      channel: {
        select: {
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

  return videos.map((video) => ({
    id: video.id,
    shortCode: video.shortCode,
    title: video.title,
    description: video.description ?? "",
    views: Number(video.views),
    thumbnail: video.thumbnail ?? "",
    type: video.type,
    createdAt: video.createdAt,
    ownerName: video.channel.owner.name,
    ownerImage: video.channel.owner.image ?? "",
  }));
}
