import { PlaybackEventType, Prisma, ReactionType, Visibility } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import {
  createHlsOutputPrefix,
  createPlaybackSignedUrl,
  createRawVideoObjectKey,
  createUploadPresignedUrl,
  ensureBucket,
  localstackConfig,
  startTranscodeExecution,
  stopTranscodeExecution,
} from "@/lib/localstack";
import prisma from "@/lib/prisma";
import {
  FAVORITES_PLAYLIST_KEY,
  WATCH_LATER_LEGACY_MATCH,
  WATCH_LATER_PLAYLIST_KEY,
} from "@/lib/system-playlists";
import { createUploadVideoDraft } from "@/lib/video-pipeline";
import { getOptionalUserId, requireUserId } from "@/lib/server/auth-session";

type VideoKind = "LONG" | "SHORT";
const CANCEL_REASON = "Canceled by studio user";

interface GetVideosInput {
  cursor?: string | null;
  limit?: number;
  type?: VideoKind;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

function normalizeLimit(limit?: number) {
  if (typeof limit !== "number" || Number.isNaN(limit)) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT);
}

export async function getVideoInfo(shortCode: string) {
  if (!shortCode) {
    notFound();
  }

  const currentUserId = await getOptionalUserId();

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: {
      id: true,
      shortCode: true,
      title: true,
      description: true,
      thumbnail: true,
      views: true,
      likesCount: true,
      commentsCount: true,
      createdAt: true,
      deletedAt: true,
      visibility: true,
      processingStatus: true,
      userId: true,
      channel: {
        select: {
          id: true,
          name: true,
          subscribersCount: true,
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

  if (!video || video.deletedAt) {
    notFound();
  }

  const isOwner = currentUserId === video.userId;

  switch (video.visibility) {
    case "PUBLIC":
    case "UNLISTED":
      if (!isOwner && video.processingStatus !== "READY") {
        notFound();
      }
      break;
    case "PRIVATE":
    case "DRAFT":
      if (!isOwner) {
        if (!currentUserId) {
          redirect(`/login?callbackUrl=/watch/${shortCode}`);
        }
        notFound();
      }
      break;
  }

  let prevReaction: ReactionType | undefined;
  let isSubscribed = false;
  let isWatchLater = false;
  let isFavorited = false;

  if (currentUserId) {
    const [reaction, subscription, watchLaterItem, favoriteItem] = await Promise.all([
      prisma.videoReaction.findUnique({
        where: {
          userId_videoId: {
            userId: currentUserId,
            videoId: video.id,
          },
        },
        select: {
          reactionType: true,
        },
      }),
      prisma.subscription.findUnique({
        where: {
          subscriberId_channelId: {
            subscriberId: currentUserId,
            channelId: video.channel.id,
          },
        },
        select: {
          id: true,
        },
      }),
      prisma.playlistItem.findFirst({
        where: {
          videoId: video.id,
          playlist: {
            ownerId: currentUserId,
            OR: [
              {
                systemKey: WATCH_LATER_PLAYLIST_KEY,
              },
              WATCH_LATER_LEGACY_MATCH,
            ],
          },
        },
        select: {
          id: true,
        },
      }),
      prisma.playlistItem.findFirst({
        where: {
          videoId: video.id,
          playlist: {
            ownerId: currentUserId,
            systemKey: FAVORITES_PLAYLIST_KEY,
          },
        },
        select: {
          id: true,
        },
      }),
    ]);

    prevReaction = reaction?.reactionType;
    isSubscribed = Boolean(subscription);
    isWatchLater = Boolean(watchLaterItem);
    isFavorited = Boolean(favoriteItem);
  }

  const { channel, userId: _userId, ...rest } = video;

  return {
    videoData: {
      ...rest,
      thumbnail: rest.thumbnail ?? "",
      views: Number(rest.views),
      likesCount: rest.likesCount,
      commentsCount: rest.commentsCount,
      prevReaction,
      isWatchLater,
      isFavorited,
    },
    channelData: {
      id: channel.id,
      name: channel.name,
      subscribersCount: channel.subscribersCount,
      owner: channel.owner,
      isSubscribed,
    },
    isOwner,
  };
}

export type GetVideoInfoResult = Awaited<ReturnType<typeof getVideoInfo>>;
export type VideoInfoData = GetVideoInfoResult["videoData"];
export type ChannelInfoData = GetVideoInfoResult["channelData"];

export async function getWatchSidebarData(shortCode: string) {
  const currentUserId = await getOptionalUserId();

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
      systemKey: null,
      NOT: WATCH_LATER_LEGACY_MATCH,
      ...(isOwner ? {} : { isPublic: true }),
      items: {
        some: {
          videoId: currentVideo.id,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
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

  const hasCurrentVideo =
    normalizedPlaylist?.items.some((item) => item.video.shortCode === shortCode) ?? false;

  return {
    playlist: hasCurrentVideo ? normalizedPlaylist : null,
  };
}

export type WatchSidebarData = Awaited<ReturnType<typeof getWatchSidebarData>>;

export async function getRecommendation(limit: number = 20, excludeShortCodes: string[] = []) {
  const excludeClause =
    excludeShortCodes.length > 0
      ? Prisma.sql`AND v."shortCode" NOT IN (${Prisma.join(excludeShortCodes)})`
      : Prisma.empty;

  const rows = await prisma.$queryRaw<{
    id: string;
    shortCode: string;
    title: string;
    views: bigint;
    thumbnail: string | null;
    createdAt: Date;
    ownerName: string;
  }[]>`
    SELECT
      v."id",
      v."shortCode",
      v."title",
      v."views",
      v."thumbnail",
      v."createdAt",
      u."name" AS "ownerName"
    FROM "Video" v
    INNER JOIN "user" u ON u."id" = v."userId"
    WHERE
      v."deletedAt" IS NULL
      AND v."visibility" = 'PUBLIC'::"Visibility"
      AND v."processingStatus" = 'READY'::"VideoProcessingStatus"
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    views: Number(row.views),
  }));
}

export type RecommendationVideoData = Awaited<ReturnType<typeof getRecommendation>>[number];

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
      nextCursor: null as string | null,
    };
  }

  const videos = await prisma.video.findMany({
    where: {
      deletedAt: null,
      visibility: "PUBLIC",
      processingStatus: "READY",
      type,
    },
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
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
              image: true,
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const hasMore = videos.length > limit;
  const page = hasMore ? videos.slice(0, limit) : videos;

  const flattened = page.map((video) => ({
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

  return {
    items: flattened,
    nextCursor: hasMore && flattened.length > 0 ? flattened[flattened.length - 1].id : null,
  };
}

export async function getVideos(input: GetVideosInput = {}) {
  const limit = normalizeLimit(input.limit);
  const type: VideoKind = input.type ?? "LONG";

  return getVideosByType(type, input.cursor, limit);
}

export type GalleryVideoData = Awaited<ReturnType<typeof getVideos>>["items"][number];
export type HistoryVideoData = GalleryVideoData & {
  lastWatchedAt: Date;
};

async function listHistoryVideosForUser(userId: string, limit: number = 24) {
  const rows = await prisma.$queryRaw<{
    id: string;
    shortCode: string;
    title: string;
    description: string | null;
    views: bigint;
    thumbnail: string | null;
    type: "LONG" | "SHORT";
    createdAt: Date;
    ownerName: string;
    ownerImage: string | null;
    lastWatchedAt: Date;
  }[]>`
    SELECT *
    FROM (
      SELECT DISTINCT ON (vpe."videoId")
        v."id",
        v."shortCode",
        v."title",
        v."description",
        v."views",
        v."thumbnail",
        v."type",
        v."createdAt",
        u."name" AS "ownerName",
        u."image" AS "ownerImage",
        vpe."createdAt" AS "lastWatchedAt"
      FROM "VideoPlaybackEvent" vpe
      INNER JOIN "Video" v ON v."id" = vpe."videoId"
      INNER JOIN "user" u ON u."id" = v."userId"
      WHERE
        vpe."userId" = ${userId}
        AND v."deletedAt" IS NULL
        AND (
          v."userId" = ${userId}
          OR (
            v."visibility" IN ('PUBLIC', 'UNLISTED')
            AND v."processingStatus" = 'READY'
          )
        )
      ORDER BY vpe."videoId", vpe."createdAt" DESC
    ) AS history
    ORDER BY history."lastWatchedAt" DESC
    LIMIT ${Math.min(Math.max(limit, 1), 48)}
  `;

  return rows.map((row) => ({
    id: row.id,
    shortCode: row.shortCode,
    title: row.title,
    description: row.description ?? "",
    views: Number(row.views),
    thumbnail: row.thumbnail ?? "",
    type: row.type,
    createdAt: row.createdAt,
    ownerName: row.ownerName,
    ownerImage: row.ownerImage ?? "",
    lastWatchedAt: row.lastWatchedAt,
  }));
}

export async function getHistoryVideos(limit: number = 24) {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login?callbackUrl=/history");
  }

  return listHistoryVideosForUser(userId, limit);
}

export async function getHistoryPreviewVideos(
  limit: number = 3,
  requestHeaders?: Headers,
) {
  const userId = await getOptionalUserId(requestHeaders);

  if (!userId) {
    return null;
  }

  return listHistoryVideosForUser(userId, limit);
}

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
    orderBy: [{ views: "desc" }, { createdAt: "desc" }],
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

export async function getVideoDetails(shortCode: string) {
  const userId = await getOptionalUserId();
  const safeShortCode = shortCode.trim();

  if (!userId) {
    redirect("/login");
  }

  if (!safeShortCode) {
    notFound();
  }

  const [video, { imageDomain }] = await Promise.all([
    prisma.video.findUnique({
      where: { shortCode: safeShortCode },
      include: {
        assets: {
          where: { assetType: "HLS_VARIANT" },
          select: { qualityLabel: true },
        },
      },
    }),
    getCdnDomains(),
  ]);

  if (!video || video.userId !== userId || video.deletedAt) {
    notFound();
  }

  const qualityPresets = video.assets
    .map((a) => a.qualityLabel)
    .filter((q): q is string => !!q);

  return { ...video, qualityPresets, imageDomain };
}

interface ListUserVideosParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  categoryId?: string;
  visibility?: string;
}

export async function listUserVideos(
  params: ListUserVideosParams,
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const {
    page,
    pageSize,
    searchTerm = "",
    categoryId = "",
    visibility = "",
  } = params;
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.min(Math.max(Math.floor(pageSize || 10), 1), 100);
  const skip = (safePage - 1) * safePageSize;
  const whereConditions: Prisma.VideoWhereInput = {
    userId,
    deletedAt: null,
    ...(searchTerm
      ? {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(visibility ? { visibility: visibility as Visibility } : {}),
  };

  const [videos, totalCount] = await Promise.all([
    prisma.video.findMany({
      where: whereConditions,
      skip,
      take: safePageSize,
      include: {
        channel: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.video.count({
      where: whereConditions,
    }),
  ]);

  return {
    videos: videos.map((video) => ({
      ...video,
      views: Number(video.views),
    })),
    totalCount,
  };
}

export type ListUserVideosResult = Awaited<ReturnType<typeof listUserVideos>>;

export type ProcessingStatusItem = {
  shortCode: string;
  processingStatus: string;
  pipelineStage: string | null;
  jobStatus: string | null;
  jobError: string | null;
};

export async function getProcessingStatuses(
  shortCodes: string[],
  requestHeaders?: Headers,
): Promise<ProcessingStatusItem[]> {
  if (shortCodes.length === 0) {
    return [];
  }

  const userId = await requireUserId(requestHeaders);
  const videos = await prisma.video.findMany({
    where: {
      shortCode: { in: shortCodes },
      userId,
    },
    select: {
      shortCode: true,
      processingStatus: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          pipelineStage: true,
          lastError: true,
        },
      },
    },
  });

  return videos.map((video) => {
    const job = video.transcodeJobs[0] ?? null;

    return {
      shortCode: video.shortCode,
      processingStatus: video.processingStatus,
      pipelineStage: job?.pipelineStage ?? null,
      jobStatus: job?.status ?? null,
      jobError: job?.lastError ?? null,
    };
  });
}

const editVideoSchema = z.object({
  shortCode: z.string().trim().min(1),
  title: z.string().trim().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  thumbnail: z.string().optional(),
  visibility: z.enum(Visibility).optional(),
});

export async function editVideo(
  params: {
    shortCode: string;
    title?: string;
    description?: string;
    thumbnail?: string;
    visibility?: Visibility;
  },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const parsed = editVideoSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { shortCode, title, description, thumbnail, visibility } = parsed.data;
  const video = await prisma.video.findFirst({
    where: {
      shortCode,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  return prisma.video.update({
    where: {
      id: video.id,
    },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(thumbnail !== undefined ? { thumbnail } : {}),
      ...(visibility !== undefined ? { visibility } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deleteVideo(shortCode: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findFirst({
    where: {
      shortCode: safeShortCode,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  return prisma.video.update({
    where: {
      id: video.id,
    },
    data: {
      deletedAt: new Date(),
    },
  });
}

export type VideoStatusResult = {
  videoId: string;
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  readyAt: Date | null;
  playbackUrl: string | null;
  expectedManifestKey: string;
  bucket: string;
};

async function resolveVideoStatus(video: {
  id: string;
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  readyAt: Date | null;
}): Promise<VideoStatusResult> {
  const primaryManifest = await prisma.videoAsset.findFirst({
    where: {
      videoId: video.id,
      assetType: "HLS_MASTER",
      isPrimary: true,
    },
    select: {
      storageBucket: true,
      storageKey: true,
    },
  });

  let playbackUrl: string | null = null;

  if (primaryManifest) {
    playbackUrl = await createPlaybackSignedUrl({
      bucket: primaryManifest.storageBucket,
      key: primaryManifest.storageKey,
    });
  }

  return {
    videoId: video.id,
    shortCode: video.shortCode,
    processingStatus: video.processingStatus,
    processingError: video.processingError,
    readyAt: video.readyAt,
    playbackUrl,
    expectedManifestKey: `${video.shortCode}/master.m3u8`,
    bucket: localstackConfig.hlsBucket,
  };
}

const videoStatusSelect = {
  id: true,
  shortCode: true,
  processingStatus: true,
  processingError: true,
  readyAt: true,
} as const;

export async function getVideoStatusById(videoId: string): Promise<VideoStatusResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: videoStatusSelect,
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  return resolveVideoStatus(video);
}

export async function getVideoStatusByShortCode(shortCode: string): Promise<VideoStatusResult> {
  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: videoStatusSelect,
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  return resolveVideoStatus(video);
}

export type PipelineStatus = {
  processingStatus: string;
  jobId: string | null;
  jobStatus: string | null;
  jobError: string | null;
  attempt: number;
  maxAttempts: number;
  pipelineStage: string | null;
  executionArn: string | null;
  inputKey: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export async function getPipelineStatus(shortCode: string): Promise<PipelineStatus> {
  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: {
      processingStatus: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          lastError: true,
          attempt: true,
          maxAttempts: true,
          pipelineStage: true,
          queueMessageId: true,
          inputKey: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  const job = video.transcodeJobs[0] ?? null;

  return {
    processingStatus: video.processingStatus,
    jobId: job?.id ?? null,
    jobStatus: job?.status ?? null,
    jobError: job?.lastError ?? null,
    attempt: job?.attempt ?? 0,
    maxAttempts: job?.maxAttempts ?? 3,
    pipelineStage: job?.pipelineStage ?? null,
    executionArn: job?.queueMessageId ?? null,
    inputKey: job?.inputKey ?? null,
    queuedAt: job?.queuedAt?.toISOString() ?? null,
    startedAt: job?.startedAt?.toISOString() ?? null,
    finishedAt: job?.finishedAt?.toISOString() ?? null,
  };
}

export type JobTimelineItem = {
  id: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  pipelineStage: string | null;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  wallSeconds: number | null;
};

export type VideoJobTimeline = {
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  jobs: JobTimelineItem[];
};

function clampTimelineLimit(input: number | undefined) {
  const value = typeof input === "number" ? Math.floor(input) : 5;
  return Math.min(Math.max(value, 1), 12);
}

export async function getVideoJobTimelineForUser(
  shortCode: string,
  userId: string,
  limit?: number,
): Promise<VideoJobTimeline> {
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findFirst({
    where: {
      shortCode: safeShortCode,
      userId,
      deletedAt: null,
    },
    select: {
      shortCode: true,
      processingStatus: true,
      processingError: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: clampTimelineLimit(limit),
        select: {
          id: true,
          status: true,
          attempt: true,
          maxAttempts: true,
          pipelineStage: true,
          lastError: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  const now = Date.now();
  const jobs = video.transcodeJobs.map((job) => {
    const endAt = job.finishedAt?.getTime() ?? now;
    const wallMs = endAt - job.queuedAt.getTime();

    return {
      id: job.id,
      status: job.status,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      pipelineStage: job.pipelineStage,
      lastError: job.lastError,
      queuedAt: job.queuedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      wallSeconds: wallMs >= 0 ? Math.floor(wallMs / 1000) : null,
    };
  });

  return {
    shortCode: video.shortCode,
    processingStatus: video.processingStatus,
    processingError: video.processingError,
    jobs,
  };
}

export async function getVideoJobTimeline(shortCode: string, limit?: number) {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect("/login");
  }

  return getVideoJobTimelineForUser(shortCode, userId, limit);
}

const endpoint = (process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566").replace(/\/$/, "");

export async function getCdnDomains(): Promise<{
  videoDomain: string;
  imageDomain: string;
}> {
  const videoDomain = process.env.CDN_VIDEO_DOMAIN
    ? `https://${process.env.CDN_VIDEO_DOMAIN}`
    : `${endpoint}/${process.env.VOD_HLS_BUCKET ?? "vod-hls"}`;

  const imageDomain = process.env.CDN_IMAGE_DOMAIN
    ? `https://${process.env.CDN_IMAGE_DOMAIN}`
    : `${endpoint}/${process.env.VOD_IMAGE_BUCKET ?? "vod-image"}`;

  return { videoDomain, imageDomain };
}

function normalizeTitle(raw: string) {
  return raw.trim().slice(0, 120) || "未命名视频";
}

export type VideoUploadUrlResult = {
  url: string;
  shortCode: string;
  videoId: string;
  uploadSessionId: string;
};

export async function getVideoUploadUrl(
  filename: string,
  contentType: string,
  videoType: "LONG" | "SHORT" = "LONG",
  title?: string,
  requestHeaders?: Headers,
): Promise<VideoUploadUrlResult> {
  const userId = await requireUserId(requestHeaders);
  const safeName = filename.trim() || "upload.mp4";
  const safeContentType = contentType.trim() || "video/mp4";
  const resolvedTitle = normalizeTitle(title ?? safeName.replace(/\.[^.]+$/, ""));

  await ensureBucket(localstackConfig.rawBucket);

  const draft = await createUploadVideoDraft({
    userId,
    title: resolvedTitle,
    filename: safeName,
    type: videoType,
  });

  const objectKey = createRawVideoObjectKey(draft.shortCode);
  const presignedUrl = await createUploadPresignedUrl({
    bucket: localstackConfig.rawBucket,
    key: objectKey,
    contentType: safeContentType,
  });

  const uploadSession = await prisma.uploadSession.create({
    data: {
      videoId: draft.id,
      uploaderId: userId,
      storageBucket: localstackConfig.rawBucket,
      objectKey,
      status: "INITIATED",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
    select: { id: true },
  });

  return {
    url: presignedUrl,
    shortCode: draft.shortCode,
    videoId: draft.id,
    uploadSessionId: uploadSession.id,
  };
}

export async function getThumbnailUploadUrl(
  filename: string,
  contentType: string,
  shortCode: string,
  requestHeaders?: Headers,
): Promise<{ url: string }> {
  await requireUserId(requestHeaders);

  const ext = filename.includes(".") ? filename.split(".").pop() : "jpg";
  const objectKey = `thumbnails/${shortCode}/thumbnail.${ext}`;

  await ensureBucket(localstackConfig.imageBucket);

  const url = await createUploadPresignedUrl({
    bucket: localstackConfig.imageBucket,
    key: objectKey,
    contentType,
  });

  return { url };
}

export async function createVideo(
  _filename: string,
  shortCode: string,
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findUnique({
    where: { shortCode: safeShortCode },
  });

  if (!video || video.userId !== userId || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const uploadSession = await prisma.uploadSession.findFirst({
    where: {
      videoId: video.id,
      uploaderId: userId,
      status: "INITIATED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      objectKey: true,
      storageBucket: true,
    },
  });

  if (!uploadSession) {
    throw new Error("未找到有效的上传会话");
  }

  const outputPrefix = createHlsOutputPrefix(video.shortCode);
  await ensureBucket(localstackConfig.hlsBucket);

  const job = await prisma.transcodeJob.create({
    data: {
      videoId: video.id,
      provider: "LOCALSTACK",
      inputBucket: uploadSession.storageBucket,
      inputKey: uploadSession.objectKey,
      outputBucket: localstackConfig.hlsBucket,
      outputPrefix,
      status: "QUEUED",
    },
    select: { id: true },
  });

  const execution = await startTranscodeExecution({
    jobId: job.id,
    videoId: video.id,
    shortCode: video.shortCode,
    inputBucket: uploadSession.storageBucket,
    inputKey: uploadSession.objectKey,
    outputBucket: localstackConfig.hlsBucket,
    outputPrefix,
    videoType: video.type as "LONG" | "SHORT",
  });

  await prisma.$transaction([
    prisma.uploadSession.update({
      where: { id: uploadSession.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.video.update({
      where: { id: video.id },
      data: { processingStatus: "PROCESSING", processingError: null },
    }),
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: { queueMessageId: execution.executionArn },
    }),
  ]);

  return prisma.video.findUniqueOrThrow({ where: { id: video.id } });
}

export async function retryVideoJob(shortCode: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findFirst({
    where: {
      shortCode: safeShortCode,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      shortCode: true,
      type: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          inputBucket: true,
          inputKey: true,
          maxAttempts: true,
        },
      },
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  const activeJob = await prisma.transcodeJob.findFirst({
    where: {
      videoId: video.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });

  if (activeJob) {
    throw new Error("当前已有进行中的任务，暂不可重试");
  }

  const previousJob = video.transcodeJobs[0];

  if (!previousJob) {
    throw new Error("未找到可复用的历史任务输入");
  }

  const outputPrefix = createHlsOutputPrefix(video.shortCode);
  await ensureBucket(localstackConfig.hlsBucket);

  const job = await prisma.transcodeJob.create({
    data: {
      videoId: video.id,
      provider: "LOCALSTACK",
      inputBucket: previousJob.inputBucket,
      inputKey: previousJob.inputKey,
      outputBucket: localstackConfig.hlsBucket,
      outputPrefix,
      status: "QUEUED",
      maxAttempts: previousJob.maxAttempts,
    },
    select: { id: true },
  });

  const execution = await startTranscodeExecution({
    jobId: job.id,
    videoId: video.id,
    shortCode: video.shortCode,
    inputBucket: previousJob.inputBucket,
    inputKey: previousJob.inputKey,
    outputBucket: localstackConfig.hlsBucket,
    outputPrefix,
    videoType: video.type,
  });

  await prisma.$transaction([
    prisma.video.update({
      where: { id: video.id },
      data: {
        processingStatus: "PROCESSING",
        processingError: null,
      },
    }),
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: { queueMessageId: execution.executionArn },
    }),
  ]);

  return {
    shortCode: video.shortCode,
    jobId: job.id,
    executionArn: execution.executionArn,
  };
}

export async function cancelVideoJob(shortCode: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findFirst({
    where: {
      shortCode: safeShortCode,
      userId,
      deletedAt: null,
    },
    select: {
      id: true,
      shortCode: true,
      processingStatus: true,
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  const activeJob = await prisma.transcodeJob.findFirst({
    where: {
      videoId: video.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      queueMessageId: true,
    },
  });

  if (!activeJob) {
    if (video.processingStatus === "UPLOADING" || video.processingStatus === "PROCESSING") {
      await prisma.video.update({
        where: { id: video.id },
        data: {
          processingStatus: "FAILED",
          processingError: CANCEL_REASON,
        },
      });

      return {
        shortCode: video.shortCode,
        jobId: null,
        status: "CANCELED",
      };
    }

    throw new Error("未找到可取消的任务");
  }

  if (activeJob.queueMessageId) {
    try {
      await stopTranscodeExecution(activeJob.queueMessageId, CANCEL_REASON);
    } catch {
      // Execution may already be terminal; local record still should be reconciled.
    }
  }

  await prisma.transcodeJob.update({
    where: { id: activeJob.id },
    data: {
      status: "CANCELED",
      finishedAt: new Date(),
      pipelineStage: null,
      lastError: CANCEL_REASON,
    },
  });

  const otherActiveCount = await prisma.transcodeJob.count({
    where: {
      videoId: video.id,
      id: { not: activeJob.id },
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (otherActiveCount === 0) {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        processingStatus: "FAILED",
        processingError: CANCEL_REASON,
      },
    });
  }

  return {
    shortCode: video.shortCode,
    jobId: activeJob.id,
    status: "CANCELED",
  };
}

export async function putVideoReaction(
  shortCode: string,
  reactionType?: ReactionType,
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const safeShortCode = shortCode.trim();

  if (!safeShortCode) {
    throw new Error("shortCode 不能为空");
  }

  const video = await prisma.video.findUnique({
    where: { shortCode: safeShortCode },
    select: {
      id: true,
      deletedAt: true,
      likesCount: true,
    },
  });

  if (!video || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const existingReaction = await prisma.videoReaction.findUnique({
      where: {
        userId_videoId: {
          userId,
          videoId: video.id,
        },
      },
    select: {
      reactionType: true,
    },
  });

  if (!reactionType || existingReaction?.reactionType === reactionType) {
    await prisma.videoReaction.deleteMany({
      where: {
        userId,
        videoId: video.id,
      },
    });

    let likesCount = video.likesCount;
    if (existingReaction?.reactionType === "LIKE") {
      likesCount = Math.max(0, likesCount - 1);
    }

    return {
      reaction: undefined,
      likesCount,
      likesDelta: existingReaction?.reactionType === "LIKE" ? -1 : 0,
    };
  }

  await prisma.videoReaction.upsert({
    where: {
      userId_videoId: {
        userId,
        videoId: video.id,
      },
    },
    create: {
      userId,
      videoId: video.id,
      reactionType,
    },
    update: {
      reactionType,
    },
  });

  let likesDelta = 0;
  if (existingReaction?.reactionType === "LIKE") {
    likesDelta -= 1;
  }
  if (reactionType === "LIKE") {
    likesDelta += 1;
  }

  return {
    reaction: reactionType,
    likesCount: Math.max(0, video.likesCount + likesDelta),
    likesDelta,
  };
}

export async function recordPlaybackEvent(
  params: {
    shortCode: string;
    sessionId: string;
    eventType: PlaybackEventType;
    positionSeconds?: number;
    durationSeconds?: number;
    watchDeltaMs?: number;
    playbackRate?: number;
    isMuted?: boolean;
    volume?: number;
  },
  requestHeaders?: Headers,
) {
  const sessionUserId = await getOptionalUserId(requestHeaders);
  const safeShortCode = params.shortCode.trim();

  if (!safeShortCode) {
    return;
  }

  const video = await prisma.video.findUnique({
    where: {
      shortCode: safeShortCode,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!video || video.deletedAt) {
    return;
  }

  await prisma.videoPlaybackEvent.create({
    data: {
      videoId: video.id,
      userId: sessionUserId,
      sessionId: params.sessionId,
      eventType: params.eventType,
      positionSeconds: params.positionSeconds,
      durationSeconds: params.durationSeconds,
      watchDeltaMs: params.watchDeltaMs,
      playbackRate:
        typeof params.playbackRate === "number"
          ? new Prisma.Decimal(params.playbackRate.toFixed(2))
          : undefined,
      isMuted: params.isMuted,
      volume: params.volume,
      referrer: requestHeaders?.get("referer") ?? undefined,
      userAgent: requestHeaders?.get("user-agent") ?? undefined,
      source: "web",
    },
  });
}
