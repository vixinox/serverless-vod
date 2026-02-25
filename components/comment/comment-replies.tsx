'use client';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { useReplies } from "@/hooks/use-replies";
import { Reply } from "@/components/comment/reply";

interface RepliesProps {
  commentId: string;
  repliesCount?: number;
}

export function CommentReplies({ commentId, repliesCount = 0 }: RepliesProps) {
  const [showReplies, setShowReplies] = useState(false);

  const {
    replies,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    error,
    addReply,
    removeReply,
    updateReply,
    toggleReaction,
  } = useReplies(commentId, showReplies);

  if (repliesCount === 0) return null;

  return (
    <>
      <div className="flex items-center pl-12">
        <Button
          variant="ghost"
          className="hover:text-blue-500 hover:bg-blue-500/30 rounded-full text-blue-500 gap-2 cursor-pointer"
          onClick={() => setShowReplies(prev => !prev)}
        >
          <ChevronDown
            className={cn("transition size-6", showReplies && "rotate-180")}
          />
          {`${repliesCount} 条回复`}
        </Button>
      </div>

      {showReplies && (
        <div className="flex flex-col ml-12 mt-4 relative">
          {isLoading && (
            <Spinner className="absolute left-1/2 -translate-x-1/2 size-8"/>
          )}
          {error && (
            <p className="text-red-500 text-sm mb-2">
              加载回复时出错，请稍后再试
            </p>
          )}
          {!isLoading &&
           replies.map((reply) => (
             <Reply
               key={reply.replyId}
               data={reply}
               onSubmit={addReply}
               onDelete={removeReply}
               onEdit={updateReply}
               toggleReaction={toggleReaction}
             />
           ))}
          {hasMore && (
            <Button
              variant="ghost"
              className="hover:text-blue-500 hover:bg-blue-500/30 rounded-full text-blue-500 gap-2 cursor-pointer mt-2"
              onClick={loadMore}
              disabled={isLoadingMore}
            >
              {isLoadingMore ? (
                <Spinner className="size-4"/>
              ) : (
                <ChevronDown className={cn("transition size-6")}/>
              )}
              <p>显示更多</p>
            </Button>
          )}
        </div>
      )}
    </>
  );
}