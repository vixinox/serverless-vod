import useSWRInfinite from 'swr/infinite';
import { getReplies, ReplyCursor, ReplyData } from "@/actions/comment/get-replies";
import { ReactionType } from '@prisma/client';

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
    return await getReplies(cId, cursor);
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

  const addReply = async (_text: string) => {};

  const removeReply = async (_replyId: string) => {};

  const updateReply = async (_replyId: string, _newContent: string) => {};

  const toggleReaction = async (_replyId: string, _reactionType?: ReactionType) => {};

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