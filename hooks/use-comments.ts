import useSWRInfinite from 'swr/infinite';
import { CommentData, getComments, NextCursor } from '@/actions/comment/get-comments';
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

  const addComment = async (_text: string) => {};

  const removeComment = async (_commentId: string) => {};

  const updateComment = async (_commentId: string, _newContent: string) => {};

  const toggleReaction = async (_commentId: string, _reactionType?: ReactionType) => {};

  const addReply = async (_commentId: string, _text: string) => {};

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