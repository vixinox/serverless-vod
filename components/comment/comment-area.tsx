'use client'

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TextAlignStart } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { CommentData } from "@/actions/comment/get-comments";
import { CommentTextarea } from "@/components/comment/comment-textarea";
import { useComments } from "@/hooks/use-comments";
import { Comment } from "@/components/comment/comment";

export function CommentArea({ shortCode }: { shortCode: string }) {
  const [order, setOrder] = useState<"POPULAR" | "LATEST">("POPULAR");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const {
    comments,
    commentsCount,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    addComment,
    addReply,
    removeComment,
    updateComment,
    toggleReaction,
  } = useComments(shortCode, order);

  useEffect(() => {
    if (!loadMoreRef.current || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) loadMore();
      },
      { rootMargin: '100px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoadingMore]);

  return (
    <div className="w-full flex flex-col">
      {isLoading ? (
        <div className="flex gap-4">
          <Skeleton className="h-6 w-48"/>
          <Skeleton className="h-6 w-12"/>
        </div>
      ) : (
        <div className="flex gap-8 mb-4">
          <h1 className="text-xl font-bold">{commentsCount} 条评论</h1>
          <Popover>
            <PopoverTrigger asChild>
              <div className="flex gap-2 items-center cursor-pointer">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <TextAlignStart strokeWidth="1"/>
                      <p className="text-sm">排序方式</p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">更改排序方式</TooltipContent>
                </Tooltip>
              </div>
            </PopoverTrigger>

            <PopoverContent className="flex flex-col p-0 w-fit overflow-hidden">
              <div
                className={cn(
                  "w-20 h-12 flex items-center p-4 text-sm cursor-pointer hover:bg-foreground/15",
                  order === "POPULAR" && "bg-foreground/30"
                )}
                onClick={() => setOrder("POPULAR")}
              >
                最热门
              </div>
              <div
                className={cn(
                  "w-20 h-12 flex items-center p-4 text-sm cursor-pointer hover:bg-foreground/15",
                  order === "LATEST" && "bg-foreground/30"
                )}
                onClick={() => setOrder("LATEST")}
              >
                最新
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      <CommentTextarea
        mode="comment"
        onSubmit={addComment}
        isLoading={isLoading}
        visible
      />

      <div className="w-full flex flex-col gap-4 mt-8">
        {isLoading ? (
          <CommentBlockSkeleton/>
        ) : (
          <>
            {comments.map((c: CommentData) => (
              <Comment
                key={c.commentId}
                comment={c}
                onEdit={updateComment}
                onDelete={removeComment}
                onReplySubmit={(content: string) => addReply(c.commentId, content)}
                toggleReaction={toggleReaction}
              />
            ))}

            <div className="flex flex-col w-full gap-8 pb-4">
              <div className="h-1/3"/>
              {hasMore && <div ref={loadMoreRef}/>}
              {isLoadingMore && (
                <>
                  <CommentBlockSkeleton/>
                  <CommentBlockSkeleton/>
                  <CommentBlockSkeleton/>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const CommentBlockSkeleton = () => (
  <div className="space-y-2">
    <div className="flex gap-3">
      <Skeleton className="w-10 h-10 rounded-full size-10"/>
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32"/>
        <Skeleton className="h-4 w-5/6"/>
        <Skeleton className="h-4 w-3/4"/>
      </div>
    </div>
    <div className="flex gap-2 ml-13">
      <Skeleton className="h-4 w-16"/>
      <Skeleton className="h-4 w-16"/>
    </div>
  </div>
);