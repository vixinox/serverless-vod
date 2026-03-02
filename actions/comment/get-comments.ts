'use server';

import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ReactionType } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export type NextCursor = {
  id: string;
  createdAt: Date;
  likesCount?: number;
} | null;

export interface CommentData {
  commentId: string;
  userId: string;
  image: string | undefined;
  name: string;
  content: string;
  createdAt: Date;
  likesCount: number;
  repliesCount?: number;
  prevReaction: ReactionType | undefined;
}

function getOrderBy(order: "POPULAR" | "LATEST"): Prisma.CommentOrderByWithRelationInput[] {
  if (order === "POPULAR") {
    return [{ likesCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }
  return [{ createdAt: "desc" }, { id: "desc" }];
}

function buildCursorFilter(order: "POPULAR" | "LATEST", cursor?: NextCursor) {
  if (!cursor) return {};

  if (order === "POPULAR") {
    const likesCount = cursor.likesCount ?? 0;
    return {
      OR: [
        { likesCount: { lt: likesCount } },
        {
          likesCount: likesCount,
          createdAt: { lt: cursor.createdAt }
        },
        {
          likesCount: likesCount,
          createdAt: cursor.createdAt,
          id: { lt: cursor.id },
        },
      ],
    } satisfies Prisma.CommentWhereInput;
  }

  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  } satisfies Prisma.CommentWhereInput;
}

const commentSelect = {
  id: true,
  userId: true,
  content: true,
  createdAt: true,
  likesCount: true,
  repliesCount: true,
  user: { select: { id: true, name: true, image: true } },
} satisfies Prisma.CommentSelect;

type CommentWithUser = Prisma.CommentGetPayload<{
  select: typeof commentSelect & {
    reactions?: { select: { reactionType: true } } | false;
  };
}>;

function mapComment(comment: CommentWithUser): CommentData {
  return {
    commentId: comment.id,
    userId: comment.userId,
    image: comment.user.image ?? undefined,
    name: comment.user.name,
    content: comment.content,
    createdAt: comment.createdAt,
    likesCount: comment.likesCount,
    repliesCount: comment.repliesCount,
    prevReaction: Array.isArray(comment.reactions) ?
      comment.reactions[0]?.reactionType ?? undefined
      : undefined,
  };
}

export async function getComments(
  shortCode: string,
  order: "POPULAR" | "LATEST",
  limit: number = 20,
  cursor?: NextCursor,
) {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const currentUserId = session?.user?.id ?? null;

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: { id: true, deletedAt: true, commentsCount: true },
  });

  if (!video || video.deletedAt) notFound();

  const orderBy = getOrderBy(order);
  const cursorFilter = buildCursorFilter(order, cursor);

  const comments = await prisma.comment.findMany({
    where: {
      videoId: video.id,
      deletedAt: null,
      ...cursorFilter,
    },
    orderBy,
    take: limit + 1,
    select: {
      ...commentSelect,
      reactions: currentUserId
        ? { where: { userId: currentUserId }, select: { reactionType: true } }
        : false,
    },
  });

  const hasNext = comments.length > limit;
  const sliced = hasNext ? comments.slice(0, limit) : comments;

  const nextCursor: NextCursor = hasNext
    ? {
      id: comments[limit].id,
      createdAt: comments[limit].createdAt,
      ...(order === "POPULAR" && { likesCount: comments[limit].likesCount }),
    }
    : null;

  return {
    comments: sliced.map(mapComment),
    nextCursor,
    commentsCount: video.commentsCount,
  };
}