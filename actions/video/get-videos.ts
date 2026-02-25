'use server'

import prisma from "@/lib/prisma";

type VideoKind = "LONG" | "SHORT";

interface GetVideosInput {
  longCursor?: string | null;
  shortCursor?: string | null;
  longLimit?: number;
  shortLimit?: number;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

function normalizeLimit(limit?: number) {
  if (typeof limit !== "number" || Number.isNaN(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

async function getVideosByType(type: VideoKind, cursor: string | null | undefined, limit: number) {
  if (cursor === null) {
    return {
      items: [] as Array<{
        id: string;
        shortCode: string;
        title: string;
        description: string;
        views: number;
        thumbnail: string;
        type: VideoKind;
        createdAt: Date;
        ownerName: string;
        ownerImage: string;
      }>,
      nextCursor: null as string | null
    };
  }

  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      visibility: "PUBLIC",
      processingStatus: "READY",
      type
    },
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1
        }
      : {}),
    take: limit + 1,
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
              image: true
            }
          }
        }
      }
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }]
  });

  const hasMore = videos.length > limit;
  const page = hasMore ? videos.slice(0, limit) : videos;

  const flattened = page.map(v => ({
    id: v.id,
    shortCode: v.shortCode,
    title: v.title,
    description: v.description ?? "",
    views: v.views,
    thumbnail: v.thumbnail ?? "",
    type: v.type,
    createdAt: v.createdAt,
    ownerName: v.channel.owner.name,
    ownerImage: v.channel.owner.image ?? ""
  }));

  return {
    items: flattened,
    nextCursor: hasMore && flattened.length > 0 ? flattened[flattened.length - 1].id : null
  };
}

export async function getVideos(input: GetVideosInput = {}) {
  const longLimit = normalizeLimit(input.longLimit);
  const shortLimit = normalizeLimit(input.shortLimit);

  const [longPage, shortPage] = await Promise.all([
    getVideosByType("LONG", input.longCursor, longLimit),
    getVideosByType("SHORT", input.shortCursor, shortLimit)
  ]);

  return {
    long: longPage.items,
    short: shortPage.items,
    nextLongCursor: longPage.nextCursor,
    nextShortCursor: shortPage.nextCursor
  };
}

export type VideoData = Awaited<ReturnType<typeof getVideos>>["long"][number];