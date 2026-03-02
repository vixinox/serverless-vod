'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function updateComment(
  commentId: string,
  content: string,
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const trimmed = content.trim();
  if (!trimmed) throw new Error("评论内容不能为空");

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { userId: true },
  });
  if (!comment) throw new Error("评论不存在");
  if (comment.userId !== session.user.id) throw new Error("无权限修改此评论");

  await prisma.comment.update({
    where: { id: commentId },
    data: { content: trimmed },
  });
}
