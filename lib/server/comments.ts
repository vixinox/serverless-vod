import { Prisma, ReactionType } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOptionalUserId, requireUserId } from "@/lib/server/auth-session";

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

function getOrderBy(order: "POPULAR" | "LATEST"): Prisma.CommentOrderByWithRelationInput[] {
  if (order === "POPULAR") {
    return [{ likesCount: "desc" }, { createdAt: "desc" }, { id: "desc" }];
  }

  return [{ createdAt: "desc" }, { id: "desc" }];
}

function buildCursorFilter(order: "POPULAR" | "LATEST", cursor?: NextCursor) {
  if (!cursor) {
    return {};
  }

  if (order === "POPULAR") {
    const likesCount = cursor.likesCount ?? 0;

    return {
      OR: [
        { likesCount: { lt: likesCount } },
        {
          likesCount,
          createdAt: { lt: cursor.createdAt },
        },
        {
          likesCount,
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
    prevReaction: Array.isArray(comment.reactions)
      ? comment.reactions[0]?.reactionType ?? undefined
      : undefined,
  };
}

export async function getComments(
  shortCode: string,
  order: "POPULAR" | "LATEST",
  limit: number = 20,
  cursor?: NextCursor,
  requestHeaders?: Headers,
) {
  const currentUserId = await getOptionalUserId(requestHeaders);

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: { id: true, deletedAt: true, commentsCount: true },
  });

  if (!video || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const comments = await prisma.comment.findMany({
    where: {
      videoId: video.id,
      deletedAt: null,
      ...buildCursorFilter(order, cursor),
    },
    orderBy: getOrderBy(order),
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

export async function addComment(
  shortCode: string,
  content: string,
  requestHeaders?: Headers,
): Promise<CommentData> {
  const userId = await requireUserId(requestHeaders);
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("评论内容不能为空");
  }

  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: { id: true, deletedAt: true },
  });

  if (!video || video.deletedAt) {
    throw new Error("视频不存在");
  }

  const comment = await prisma.comment.create({
    data: {
      content: trimmed,
      userId,
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

export async function getReplies(
  commentId: string,
  cursor?: ReplyCursor,
  limit: number = 10,
  requestHeaders?: Headers,
) {
  const currentUserId = await getOptionalUserId(requestHeaders);

  const replies = await prisma.comment.findMany({
    where: {
      parentId: commentId,
      deletedAt: null,
      ...(cursor
        ? {
            OR: [
              { createdAt: { gt: cursor.createdAt } },
              {
                createdAt: cursor.createdAt,
                id: { gt: cursor.id },
              },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: {
      id: true,
      userId: true,
      content: true,
      createdAt: true,
      likesCount: true,
      user: { select: { id: true, name: true, image: true } },
      reactions: currentUserId
        ? {
            where: { userId: currentUserId },
            select: { reactionType: true },
          }
        : false,
    },
  });

  const hasNext = replies.length > limit;
  const slicedReplies = hasNext ? replies.slice(0, limit) : replies;

  const nextCursor: ReplyCursor = hasNext
    ? {
        id: replies[limit].id,
        createdAt: replies[limit].createdAt,
      }
    : null;

  const mappedReplies: ReplyData[] = slicedReplies.map((reply) => ({
    parentId: commentId,
    replyId: reply.id,
    userId: reply.userId,
    image: reply.user.image ?? undefined,
    name: reply.user.name,
    content: reply.content,
    createdAt: reply.createdAt,
    likesCount: reply.likesCount,
    prevReaction: currentUserId ? reply.reactions?.[0]?.reactionType ?? undefined : undefined,
  }));

  return { replies: mappedReplies, nextCursor };
}

export async function addReply(
  commentId: string,
  content: string,
  requestHeaders?: Headers,
): Promise<ReplyData> {
  const userId = await requireUserId(requestHeaders);
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("回复内容不能为空");
  }

  const parentComment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { id: true, videoId: true },
  });

  if (!parentComment) {
    throw new Error("评论不存在");
  }

  const reply = await prisma.comment.create({
    data: {
      content: trimmed,
      userId,
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

export async function updateComment(
  commentId: string,
  content: string,
  requestHeaders?: Headers,
): Promise<void> {
  const userId = await requireUserId(requestHeaders);
  const trimmed = content.trim();

  if (!trimmed) {
    throw new Error("评论内容不能为空");
  }

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { userId: true },
  });

  if (!comment) {
    throw new Error("评论不存在");
  }

  if (comment.userId !== userId) {
    throw new Error("无权限修改此评论");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { content: trimmed },
  });
}

export async function deleteComment(commentId: string, requestHeaders?: Headers): Promise<void> {
  const userId = await requireUserId(requestHeaders);

  const comment = await prisma.comment.findUnique({
    where: { id: commentId, deletedAt: null },
    select: { userId: true },
  });

  if (!comment) {
    throw new Error("评论不存在");
  }

  if (comment.userId !== userId) {
    throw new Error("无权限删除此评论");
  }

  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}

export async function toggleCommentReaction(
  commentId: string,
  reactionType?: ReactionType,
  requestHeaders?: Headers,
): Promise<void> {
  const userId = await requireUserId(requestHeaders);

  if (!reactionType) {
    await prisma.commentReaction.deleteMany({
      where: { userId, commentId },
    });
    return;
  }

  await prisma.commentReaction.upsert({
    where: {
      userId_commentId: { userId, commentId },
    },
    create: { userId, commentId, reactionType },
    update: { reactionType },
  });
}
