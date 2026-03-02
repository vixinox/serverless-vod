'use server'

import prisma from "@/lib/prisma";

export async function getRecommendation() {
  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      visibility: "PUBLIC",
      processingStatus: "READY",
    },
    select: {
      id: true,
      shortCode: true,
      title: true,
      views: true,
      thumbnail: true,
      createdAt: true,
      channel: {
        select: {
          owner: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  return videos.map(v => ({
    id: v.id,
    shortCode: v.shortCode,
    title: v.title,
    views: v.views,
    thumbnail: v.thumbnail,
    createdAt: v.createdAt,
    ownerName: v.channel.owner.name,
  }));
}

export type VideoData = Awaited<ReturnType<typeof getRecommendation>>[number];