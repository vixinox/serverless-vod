import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getOptionalUserId, requireUserId } from "@/lib/server/auth-session";
import {
  FAVORITES_PLAYLIST_KEY,
  SystemPlaylistKey,
  WATCH_LATER_LEGACY_MATCH,
  WATCH_LATER_PLAYLIST_KEY,
  getSystemPlaylistMeta,
} from "@/lib/system-playlists";
import type { GalleryVideoData } from "@/lib/server/videos";

function getSystemPlaylistLookupWhere(
  userId: string,
  systemKey: SystemPlaylistKey,
): Prisma.PlaylistWhereInput {
  if (systemKey === WATCH_LATER_PLAYLIST_KEY) {
    return {
      ownerId: userId,
      OR: [
        {
          systemKey,
        },
        WATCH_LATER_LEGACY_MATCH,
      ],
    };
  }

  return {
    ownerId: userId,
    systemKey,
  };
}

function getEditablePlaylistWhere(userId: string, playlistId?: string): Prisma.PlaylistWhereInput {
  return {
    ownerId: userId,
    systemKey: null,
    NOT: WATCH_LATER_LEGACY_MATCH,
    ...(playlistId
      ? {
          id: playlistId,
        }
      : {}),
  };
}

async function ensureSystemPlaylist(
  tx: Prisma.TransactionClient,
  userId: string,
  systemKey: SystemPlaylistKey,
) {
  const meta = getSystemPlaylistMeta(systemKey);

  const existingSystemPlaylist = await tx.playlist.findFirst({
    where: {
      ownerId: userId,
      systemKey,
    },
    select: {
      id: true,
      title: true,
      systemKey: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingSystemPlaylist) {
    return {
      id: existingSystemPlaylist.id,
      title: existingSystemPlaylist.title,
    };
  }

  const legacyPlaylist =
    systemKey === WATCH_LATER_PLAYLIST_KEY
      ? await tx.playlist.findFirst({
          where: {
            ownerId: userId,
            ...WATCH_LATER_LEGACY_MATCH,
          },
          select: {
            id: true,
            title: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        })
      : null;

  if (legacyPlaylist) {
    return tx.playlist.update({
      where: {
        id: legacyPlaylist.id,
      },
      data: {
        title: meta.title,
        description: meta.description,
        isPublic: false,
        systemKey,
      },
      select: {
        id: true,
        title: true,
      },
    });
  }

  return tx.playlist.create({
    data: {
      ownerId: userId,
      title: meta.title,
      description: meta.description,
      isPublic: false,
      systemKey,
    },
    select: {
      id: true,
      title: true,
    },
  });
}

export async function toggleSystemPlaylistVideo(
  shortCode: string,
  systemKey: SystemPlaylistKey,
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
    video.userId === userId ||
    ((video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
      video.processingStatus === "READY");

  if (!canSave) {
    throw new Error("该视频当前不可收藏");
  }

  return prisma.$transaction(async (tx) => {
    const playlist = await ensureSystemPlaylist(tx, userId, systemKey);

    const existingItem = await tx.playlistItem.findFirst({
      where: {
        playlistId: playlist.id,
        videoId: video.id,
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
        playlistKey: systemKey,
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
        videoId: video.id,
        addedById: userId,
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
      playlistKey: systemKey,
    };
  });
}

export async function toggleVideoSave(shortCode: string, requestHeaders?: Headers) {
  return toggleSystemPlaylistVideo(shortCode, WATCH_LATER_PLAYLIST_KEY, requestHeaders);
}

export type SavedVideoData = GalleryVideoData & {
  savedAt: Date;
};

async function listSystemPlaylistVideosForUser(
  userId: string,
  systemKey: SystemPlaylistKey,
  limit: number = 24,
) {
  const items = await prisma.playlistItem.findMany({
    where: {
      playlist: getSystemPlaylistLookupWhere(userId, systemKey),
      video: {
        deletedAt: null,
        OR: [
          {
            userId,
          },
          {
            visibility: {
              in: ["PUBLIC", "UNLISTED"],
            },
            processingStatus: "READY",
          },
        ],
      },
    },
    orderBy: [{ createdAt: "desc" }, { position: "desc" }],
    take: Math.min(Math.max(limit, 1), 48),
    select: {
      createdAt: true,
      video: {
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
      },
    },
  });

  return items.map((item) => ({
    id: item.video.id,
    shortCode: item.video.shortCode,
    title: item.video.title,
    description: item.video.description ?? "",
    views: Number(item.video.views),
    thumbnail: item.video.thumbnail ?? "",
    type: item.video.type,
    createdAt: item.video.createdAt,
    ownerName: item.video.channel.owner.name,
    ownerImage: item.video.channel.owner.image ?? "",
    savedAt: item.createdAt,
  }));
}

async function getRequiredSystemPlaylistVideos(
  systemKey: SystemPlaylistKey,
  limit: number,
  callbackUrl: string,
) {
  const userId = await getOptionalUserId();

  if (!userId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }

  return listSystemPlaylistVideosForUser(userId, systemKey, limit);
}

async function getOptionalSystemPlaylistVideos(
  systemKey: SystemPlaylistKey,
  limit: number = 3,
  requestHeaders?: Headers,
) {
  const userId = await getOptionalUserId(requestHeaders);

  if (!userId) {
    return null;
  }

  return listSystemPlaylistVideosForUser(userId, systemKey, limit);
}

export async function getSavedVideos(limit: number = 24) {
  return getRequiredSystemPlaylistVideos(FAVORITES_PLAYLIST_KEY, limit, "/saved");
}

export async function getWatchLaterVideos(limit: number = 24) {
  return getRequiredSystemPlaylistVideos(
    WATCH_LATER_PLAYLIST_KEY,
    limit,
    "/saved?list=wl",
  );
}

export async function getSavedPreviewVideos(
  limit: number = 3,
  requestHeaders?: Headers,
) {
  return getOptionalSystemPlaylistVideos(FAVORITES_PLAYLIST_KEY, limit, requestHeaders);
}

export async function getWatchLaterPreviewVideos(
  limit: number = 3,
  requestHeaders?: Headers,
) {
  return getOptionalSystemPlaylistVideos(
    WATCH_LATER_PLAYLIST_KEY,
    limit,
    requestHeaders,
  );
}

interface ListUserPlaylistsParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  videoShortCode?: string;
}

export async function listUserPlaylists(
  params: ListUserPlaylistsParams,
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const { page, pageSize, searchTerm = "", videoShortCode } = params;
  const safePage = Math.max(1, Math.floor(page || 1));
  const safePageSize = Math.min(Math.max(Math.floor(pageSize || 10), 1), 100);
  const skip = (safePage - 1) * safePageSize;
  const where: Prisma.PlaylistWhereInput = {
    ...getEditablePlaylistWhere(userId),
    ...(searchTerm
      ? {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        }
      : {}),
  };

  const totalCountPromise = prisma.playlist.count({ where });

  if (videoShortCode) {
    const [playlists, totalCount] = await Promise.all([
      prisma.playlist.findMany({
        where,
        skip,
        take: safePageSize,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          ownerId: true,
          title: true,
          description: true,
          isPublic: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              items: true,
            },
          },
          items: {
            where: {
              video: {
                shortCode: videoShortCode,
                deletedAt: null,
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      }),
      totalCountPromise,
    ]);

    return {
      playlists: playlists.map(({ items, ...playlist }) => ({
        ...playlist,
        containsVideo: items.length > 0,
      })),
      totalCount,
    };
  }

  const [playlists, totalCount] = await Promise.all([
    prisma.playlist.findMany({
      where,
      skip,
      take: safePageSize,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        _count: {
          select: {
            items: true,
          },
        },
      },
    }),
    totalCountPromise,
  ]);

  return {
    playlists: playlists.map((playlist) => ({
      ...playlist,
      containsVideo: undefined,
    })),
    totalCount,
  };
}

export type ListUserPlaylistsResult = Awaited<ReturnType<typeof listUserPlaylists>>;
export type PlaylistListRow = ListUserPlaylistsResult["playlists"][number];

export async function listPlaylistItems(playlistId: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safePlaylistId = playlistId.trim();

  if (!safePlaylistId) {
    throw new Error("playlistId 不能为空");
  }

  const playlist = await prisma.playlist.findFirst({
    where: {
      ...getEditablePlaylistWhere(userId),
      id: safePlaylistId,
    },
    select: {
      id: true,
    },
  });

  if (!playlist) {
    throw new Error("播放列表不存在");
  }

  return prisma.playlistItem.findMany({
    where: {
      playlistId: safePlaylistId,
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

export type PlaylistItemRow = Awaited<ReturnType<typeof listPlaylistItems>>[number];

export async function listUserVideosForPlaylist(
  searchTerm?: string,
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const where: Prisma.VideoWhereInput = {
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

export type PlaylistVideoOption = Awaited<
  ReturnType<typeof listUserVideosForPlaylist>
>[number];

const createPlaylistSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export async function createPlaylist(
  params: {
    title: string;
    description?: string;
    isPublic?: boolean;
  },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const parsed = createPlaylistSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { title, description, isPublic = true } = parsed.data;

  return prisma.playlist.create({
    data: {
      ownerId: userId,
      title,
      description,
      isPublic,
    },
  });
}

const updatePlaylistSchema = z.object({
  playlistId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export async function updatePlaylist(
  params: {
    playlistId: string;
    title?: string;
    description?: string;
    isPublic?: boolean;
  },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const parsed = updatePlaylistSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, title, description, isPublic } = parsed.data;
  const playlist = await prisma.playlist.findFirst({
    where: getEditablePlaylistWhere(userId, playlistId),
    select: {
      id: true,
    },
  });

  if (!playlist) {
    throw new Error("播放列表不存在");
  }

  return prisma.playlist.update({
    where: {
      id: playlist.id,
    },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deletePlaylist(playlistId: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safePlaylistId = playlistId.trim();

  if (!safePlaylistId) {
    throw new Error("playlistId 不能为空");
  }

  const playlist = await prisma.playlist.findFirst({
    where: getEditablePlaylistWhere(userId, safePlaylistId),
    select: {
      id: true,
    },
  });

  if (!playlist) {
    throw new Error("播放列表不存在");
  }

  return prisma.playlist.delete({
    where: {
      id: playlist.id,
    },
  });
}

const addVideoToPlaylistSchema = z.object({
  playlistId: z.string().trim().min(1),
  videoShortCode: z.string().trim().min(1),
});

export async function addVideoToPlaylist(
  params: {
    playlistId: string;
    videoShortCode: string;
  },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const parsed = addVideoToPlaylistSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, videoShortCode } = parsed.data;
  const playlist = await prisma.playlist.findFirst({
    where: getEditablePlaylistWhere(userId, playlistId),
    select: {
      id: true,
    },
  });

  if (!playlist) {
    throw new Error("播放列表不存在");
  }

  const video = await prisma.video.findFirst({
    where: {
      shortCode: videoShortCode,
      deletedAt: null,
    },
    select: {
      id: true,
      userId: true,
      visibility: true,
      processingStatus: true,
    },
  });

  if (!video) {
    throw new Error("视频不存在");
  }

  const canAdd =
    video.userId === userId ||
    ((video.visibility === "PUBLIC" || video.visibility === "UNLISTED") &&
      video.processingStatus === "READY");

  if (!canAdd) {
    throw new Error("该视频当前不可加入播放列表");
  }

  const existed = await prisma.playlistItem.findFirst({
    where: {
      playlistId,
      videoId: video.id,
    },
    select: {
      id: true,
    },
  });

  if (existed) {
    throw new Error("该视频已在播放列表中");
  }

  return prisma.$transaction(async (tx) => {
    const latestItem = await tx.playlistItem.findFirst({
      where: {
        playlistId,
      },
      orderBy: {
        position: "desc",
      },
      select: {
        position: true,
      },
    });
    const nextPosition = (latestItem?.position ?? -1) + 1;
    const item = await tx.playlistItem.create({
      data: {
        playlistId,
        videoId: video.id,
        addedById: userId,
        position: nextPosition,
      },
    });

    await tx.playlist.update({
      where: {
        id: playlistId,
      },
      data: {
        updatedAt: new Date(),
      },
    });

    return item;
  });
}

const removeVideoFromPlaylistSchema = z.object({
  playlistId: z.string().trim().min(1),
  videoId: z.string().trim().min(1),
});

export async function removeVideoFromPlaylist(
  params: {
    playlistId: string;
    videoId: string;
  },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);
  const parsed = removeVideoFromPlaylistSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, videoId } = parsed.data;
  const item = await prisma.playlistItem.findFirst({
    where: {
      playlistId,
      videoId,
      playlist: {
        ownerId: userId,
        systemKey: null,
        NOT: WATCH_LATER_LEGACY_MATCH,
      },
    },
    select: {
      id: true,
    },
  });

  if (!item) {
    throw new Error("播放列表中不存在该视频");
  }

  return removePlaylistItem(item.id, requestHeaders);
}

export async function removePlaylistItem(itemId: string, requestHeaders?: Headers) {
  const userId = await requireUserId(requestHeaders);
  const safeItemId = itemId.trim();

  if (!safeItemId) {
    throw new Error("itemId 不能为空");
  }

  const item = await prisma.playlistItem.findFirst({
    where: {
      id: safeItemId,
      playlist: {
        ownerId: userId,
        systemKey: null,
        NOT: WATCH_LATER_LEGACY_MATCH,
      },
    },
    select: {
      id: true,
      position: true,
      playlistId: true,
    },
  });

  if (!item) {
    throw new Error("播放列表项不存在");
  }

  await prisma.$transaction([
    prisma.playlistItem.delete({
      where: {
        id: item.id,
      },
    }),
    prisma.playlistItem.updateMany({
      where: {
        playlistId: item.playlistId,
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
        id: item.playlistId,
      },
      data: {
        updatedAt: new Date(),
      },
    }),
  ]);
}
