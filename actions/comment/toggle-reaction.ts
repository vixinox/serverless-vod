'use server';

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ReactionType } from "@prisma/client";

export async function toggleCommentReaction(
  commentId: string,
  reactionType?: ReactionType,
): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  if (!reactionType) {
    await prisma.commentReaction.deleteMany({
      where: { userId: session.user.id, commentId },
    });
    return;
  }

  await prisma.commentReaction.upsert({
    where: {
      userId_commentId: { userId: session.user.id, commentId },
    },
    create: { userId: session.user.id, commentId, reactionType },
    update: { reactionType },
  });
}
