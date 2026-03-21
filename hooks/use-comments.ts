import useSWRInfinite from 'swr/infinite';
import { mutate as globalMutate } from 'swr';
import { ReactionType } from '@prisma/client';
import { apiRequest } from "@/lib/api-client";
import type { CommentData, NextCursor } from '@/lib/server/comments';

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
        const params = new URLSearchParams({
          order: order as string,
          limit: String(limit),
        });

        if (cursor) {
          params.set("cursor", JSON.stringify(cursor));
        }

        const result = await apiRequest<PageData>(
          `/api/videos/${shortCode as string}/comments?${params.toString()}`
        );

        return {
          ...result,
          comments: result.comments.map((comment) => ({
            ...comment,
            createdAt: new Date(comment.createdAt),
          })),
          nextCursor: result.nextCursor
            ? {
                ...result.nextCursor,
                createdAt: new Date(result.nextCursor.createdAt),
              }
            : null,
        };
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
    const response = await apiRequest<CommentData>(`/api/videos/${shortCode}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    });
    const newComment = {
      ...response,
      createdAt: new Date(response.createdAt),
    };
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
      await apiRequest<{ success: true }>(`/api/comments/${commentId}`, {
        method: "DELETE",
      });
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
      await apiRequest<{ success: true }>(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newContent }),
      });
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
      await apiRequest<{ success: true }>(`/api/comments/${commentId}/reaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reactionType: reactionType ?? null }),
      });
    } catch (e) {
      mutate();
      throw e;
    }
  };

  const addReply = async (commentId: string, text: string) => {
    await apiRequest(`/api/comments/${commentId}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    });
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
