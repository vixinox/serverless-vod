'use server'

import prisma from "@/lib/prisma";
import { ReactionType } from "@prisma/client";
import { redirect } from "next/navigation";

export type ReplyCursor = {
  id: string;
  createdAt: Date;
} | null;

export interface ReplyData {
  parentId: string;
  replyId: string;
  userId: string;
  image: string | undefined;
  name: string;
  content: string;
  createdAt: Date;
  likesCount: number;
  prevReaction: ReactionType | undefined;
}

export async function getReplies(
  commentId: string,
  cursor?: ReplyCursor,
  limit: number = 10
) {
  const currentUserId = undefined;

  if (!currentUserId) redirect('/auth/sign-in')

  let cursorFilter = {};
  if (cursor) {
    cursorFilter = {
      OR: [
        { createdAt: { gt: cursor.createdAt } },
        {
          createdAt: cursor.createdAt,
          id: { gt: cursor.id },
        },
      ],
    };
  }

  const replies = await prisma.comment.findMany({
    where: {
      parentId: commentId,
      deletedAt: null,
      ...cursorFilter,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
    take: limit + 1,
    select: {
      id: true,
      userId: true,
      content: true,
      createdAt: true,
      likesCount: true,
      user: { select: { id: true, name: true, image: true } },
      reactions: currentUserId ? {
        where: { userId: currentUserId },
        select: { reactionType: true },
      } : false,
    }
  });

  const hasNext = replies.length > limit;
  const slicedReplies = hasNext ? replies.slice(0, limit) : replies;

  const nextCursor: ReplyCursor = hasNext
    ? {
      id: replies[limit].id,
      createdAt: replies[limit].createdAt,
    }
    : null;

  const mappedReplies: ReplyData[] = slicedReplies.map((r) => ({
    parentId: commentId,
    replyId: r.id,
    userId: r.userId,
    image: r.user.image ?? undefined,
    name: r.user.name,
    content: r.content,
    createdAt: r.createdAt,
    likesCount: r.likesCount,
    prevReaction: currentUserId
      ? r.reactions?.[0]?.reactionType ?? undefined
      : undefined,
  }));

  return { replies: mappedReplies, nextCursor };
}