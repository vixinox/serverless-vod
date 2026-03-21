'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { CommentData } from "@/lib/server/comments";

export async function addComment(
  shortCode: string,
  content: string,
): Promise<CommentData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("评论内容不能为空");

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: { id: true, deletedAt: true },
  });
  if (!video || video.deletedAt) notFound();

  const comment = await prisma.comment.create({
    data: {
      content: trimmed,
      userId: session.user.id,
      videoId: video.id,
    },
    select: {
      id: true,
      userId: true,
      content: true,
      createdAt: true,
      likesCount: true,
      repliesCount: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return {
    commentId: comment.id,
    userId: comment.userId,
    image: comment.user.image ?? undefined,
    name: comment.user.name,
    content: comment.content,
    createdAt: comment.createdAt,
    likesCount: comment.likesCount,
    repliesCount: comment.repliesCount,
    prevReaction: undefined,
  };
}
