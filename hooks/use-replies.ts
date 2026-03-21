import useSWRInfinite from 'swr/infinite';
import { ReactionType } from '@prisma/client';
import { apiRequest } from "@/lib/api-client";
import type { ReplyCursor, ReplyData } from "@/lib/server/comments";

type RepliesPage = {
  replies: ReplyData[];
  nextCursor: ReplyCursor;
};

export function useReplies(commentId: string, enabled: boolean = true) {
  const getKey = (
    pageIndex: number,
    previousPageData: RepliesPage | null
  ) => {
    if (!enabled) return null;

    if (pageIndex === 0) return ['replies', commentId];
    if (!previousPageData) return null;
    if (!previousPageData.nextCursor) return null;
    return ['replies', commentId, previousPageData.nextCursor];
  };

  const fetcher = async ([_, cId, cursor]: [string, string, ReplyCursor?]) => {
    const params = new URLSearchParams();

    if (cursor) {
      params.set("cursor", JSON.stringify(cursor));
    }

    const result = await apiRequest<RepliesPage>(
      `/api/comments/${cId}/replies${params.size > 0 ? `?${params.toString()}` : ""}`
    );

    return {
      ...result,
      replies: result.replies.map((reply) => ({
        ...reply,
        createdAt: new Date(reply.createdAt),
      })),
      nextCursor: result.nextCursor
        ? {
            ...result.nextCursor,
            createdAt: new Date(result.nextCursor.createdAt),
          }
        : null,
    };
  };

  const { data, error, size, setSize, isLoading, isValidating, mutate } =
    useSWRInfinite<RepliesPage>(
      getKey,
      fetcher,
      {
        revalidateFirstPage: false,
        revalidateOnFocus: false,
      }
    );

  const replies = data ? data.flatMap(page => page.replies) : [];
  const hasMore = data ? data[data.length - 1]?.nextCursor !== null : false;

  const addReply = async (text: string) => {
    const response = await apiRequest<ReplyData>(`/api/comments/${commentId}/replies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    });
    const newReply = {
      ...response,
      createdAt: new Date(response.createdAt),
    };
    mutate((pages) => {
      if (!pages?.length) return [{ replies: [newReply], nextCursor: null }];
      const last = pages[pages.length - 1];
      return [
        ...pages.slice(0, -1),
        { ...last, replies: [...last.replies, newReply] },
      ];
    }, false);
  };

  const removeReply = async (replyId: string) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        replies: page.replies.filter((r) => r.replyId !== replyId),
      })),
      false,
    );
    try {
      await apiRequest<{ success: true }>(`/api/comments/${replyId}`, {
        method: "DELETE",
      });
    } catch (e) {
      mutate();
      throw e;
    }
  };

  const updateReply = async (replyId: string, newContent: string) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        replies: page.replies.map((r) =>
          r.replyId === replyId ? { ...r, content: newContent } : r
        ),
      })),
      false,
    );
    try {
      await apiRequest<{ success: true }>(`/api/comments/${replyId}`, {
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

  const toggleReaction = async (replyId: string, reactionType?: ReactionType) => {
    mutate((pages) =>
      pages?.map((page) => ({
        ...page,
        replies: page.replies.map((r) => {
          if (r.replyId !== replyId) return r;
          const prev = r.prevReaction;
          let likesCount = r.likesCount;
          if (prev === 'LIKE') likesCount = Math.max(0, likesCount - 1);
          if (reactionType === 'LIKE') likesCount += 1;
          return { ...r, prevReaction: reactionType, likesCount };
        }),
      })),
      false,
    );
    try {
      await apiRequest<{ success: true }>(`/api/comments/${replyId}/reaction`, {
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

  return {
    replies,
    isLoading,
    isLoadingMore: isValidating && size > 0,
    hasMore,
    loadMore: () => setSize(size + 1),
    mutate,
    error,
    addReply,
    removeReply,
    updateReply,
    toggleReaction,
  };
}
