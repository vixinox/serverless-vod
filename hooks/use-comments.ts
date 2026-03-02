import useSWRInfinite from 'swr/infinite';
import { mutate as globalMutate } from 'swr';
import { CommentData, getComments, NextCursor } from '@/actions/comment/get-comments';
import { addComment as addCommentAction } from '@/actions/comment/add-comment';
import { deleteComment } from '@/actions/comment/delete-comment';
import { updateComment as updateCommentAction } from '@/actions/comment/update-comment';
import { toggleCommentReaction } from '@/actions/comment/toggle-reaction';
import { addReply as addReplyAction } from '@/actions/comment/add-reply';
import { ReactionType } from '@prisma/client';

type PageData = {
  comments: CommentData[];
  nextCursor: NextCursor;
  commentsCount: number;
};

export function useComments(
  shortCode: string,
  order: 'POPULAR' | 'LATEST',
  limit: number = 20
) {
  const getKey = (
    pageIndex: number,
    previousPageData: { comments: CommentData[], nextCursor: NextCursor, commentsCount: number } | null
  ) => {
    if (pageIndex === 0) return ['comments', shortCode, order, limit];
    if (!previousPageData) return null;
    if (!previousPageData.nextCursor) return null;
    return ['comments', shortCode, order, limit, previousPageData.nextCursor];
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<PageData>(
      getKey,
      async ([_, shortCode, order, limit, cursor]) => {
        return await getComments(
          shortCode as string,
          order as 'POPULAR' | 'LATEST',
          limit as number,
          cursor as NextCursor
        );
      },
      {
        revalidateFirstPage: false,
        revalidateOnFocus: false,
      }
    );

  const comments = data ? data.flatMap((page) => page.comments) : [];
  const commentsCount = data?.[0]?.commentsCount ?? 0;
  const hasMore = data ? !!data[data.length - 1]?.nextCursor : false;

  const addComment = async (text: string) => {
    const newComment = await addCommentAction(shortCode, text);
    mutate((pages) => {
      if (!pages?.length) return pages;
      const [first, ...rest] = pages;
      return [
        {
          ...first,
          comments: [newComment, ...first.comments],
          commentsCount: first.commentsCount + 1,
        },
        ...rest,
      ];
    }, false);
  };

  const removeComment = async (commentId: string) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        comments: page.comments.filter((c) => c.commentId !== commentId),
        commentsCount: Math.max(0, page.commentsCount - 1),
      })),
      false,
    );
    try {
      await deleteComment(commentId);
    } catch (e) {
      mutate();
      throw e;
    }
  };

  const updateComment = async (commentId: string, newContent: string) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        comments: page.comments.map((c) =>
          c.commentId === commentId ? { ...c, content: newContent } : c
        ),
      })),
      false,
    );
    try {
      await updateCommentAction(commentId, newContent);
    } catch (e) {
      mutate();
      throw e;
    }
  };

  const toggleReaction = async (commentId: string, reactionType?: ReactionType) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        comments: page.comments.map((c) => {
          if (c.commentId !== commentId) return c;
          const prev = c.prevReaction;
          let likesCount = c.likesCount;
          if (prev === 'LIKE') likesCount = Math.max(0, likesCount - 1);
          if (reactionType === 'LIKE') likesCount += 1;
          return { ...c, prevReaction: reactionType, likesCount };
        }),
      })),
      false,
    );
    try {
      await toggleCommentReaction(commentId, reactionType);
    } catch (e) {
      mutate();
      throw e;
    }
  };

  const addReply = async (commentId: string, text: string) => {
    await addReplyAction(commentId, text);
    // Increment repliesCount for the parent comment in this cache
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        comments: page.comments.map((c) =>
          c.commentId === commentId
            ? { ...c, repliesCount: (c.repliesCount ?? 0) + 1 }
            : c
        ),
      })),
      false,
    );
    // Invalidate the replies cache for this comment so it picks up the new reply
    globalMutate(
      (key: unknown) =>
        Array.isArray(key) && key[0] === 'replies' && key[1] === commentId,
    );
  };

  return {
    comments,
    commentsCount,
    isLoading,
    isLoadingMore: isValidating && size > 0,
    hasMore,
    loadMore: () => setSize(size + 1),
    error,
    addComment,
    addReply,
    removeComment,
    updateComment,
    toggleReaction,
    mutate,
  };
}