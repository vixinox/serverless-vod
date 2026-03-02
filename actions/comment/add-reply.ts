'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ReplyData } from "./get-replies";

export async function addReply(
  commentId: string,
  content: string,
): Promise<ReplyData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("回复内容不能为空");

  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { id: true, videoId: true },
  });
  if (!parentComment) throw new Error("评论不存在");

  const reply = await prisma.comment.create({
    data: {
      content: trimmed,
      userId: session.user.id,
      videoId: parentComment.videoId,
      parentId: commentId,
    },
    select: {
      id: true,
      userId: true,
      content: true,
      createdAt: true,
      likesCount: true,
      user: { select: { id: true, name: true, image: true } },
    },
  });

  return {
    parentId: commentId,
    replyId: reply.id,
    userId: reply.userId,
    image: reply.user.image ?? undefined,
    name: reply.user.name,
    content: reply.content,
    createdAt: reply.createdAt,
    likesCount: reply.likesCount,
    prevReaction: undefined,
  };
}
