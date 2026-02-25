'use client'

import { Button } from "@/components/ui/button";
import { EllipsisVertical, Flag, PencilLine, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ReactionType } from "@prisma/client";

interface CommentActionsProps {
  userId: string;
  commentId: string;
  likesCount: number;
  prevReaction: ReactionType | undefined;
  toggleReaction: (commentId: string, reactionType?: ReactionType) => void;
  onDelete: (id: string) => void;
  setEditing: (isEditing: boolean) => void;
  isEditing: boolean;
  showTextarea: (bool: boolean) => void;
}

export function CommentActions({
  userId,
  commentId,
  likesCount,
  prevReaction,
  toggleReaction,
  onDelete,
  setEditing,
  isEditing,
  showTextarea,
}: CommentActionsProps) {
  const reaction = prevReaction;
  const likes = likesCount;

  return (
    <div className={`w-full flex items-center pl-12 ${isEditing ? "hidden" : "block}"}`}>
      <Button
        variant="ghost"
        className="hover:bg-foreground/15! rounded-full w-10 h-10 cursor-pointer"
        onClick={() => toggleReaction(commentId, prevReaction === "LIKE" ? undefined : "LIKE")}
      >
        <ThumbsUp
          strokeWidth="1"
          fill={reaction === "LIKE" ? "currentColor" : "none"}
          className="size-4 transition"
        />
      </Button>
      <p className={`text-sm text-muted-foreground ${likes > 0 && 'mr-3'}`}>
        {likes > 0 ? likes : ''}
      </p>
      <Button
        variant="ghost"
        className="hover:bg-foreground/30! rounded-full w-10 h-10 cursor-pointer"
        onClick={() => toggleReaction(commentId, prevReaction === "DISLIKE" ? undefined : "DISLIKE")}
      >
        <ThumbsDown
          strokeWidth="1"
          fill={reaction === "DISLIKE" ? "currentColor" : "none"}
          className="size-4 transition"
        />
      </Button>
      <Button
        className="hover:bg-foreground/30! rounded-full cursor-pointer ml-1"
        variant="ghost"
        onClick={() => showTextarea(true)}
      >
        回复
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="absolute w-10 h-10 rounded-full top-0 right-4 cursor-pointer hover:bg-primary/15"
          >
            <EllipsisVertical className="size-5" strokeWidth="2.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={`w-28 rounded-xl p-0 overflow-hidden ${isEditing ? "hidden" : "block}"}`}>
          {/* {(user?.id && userId === user.id) ? ( */}
          {false ? (
            <>
              <div
                className="w-full h-11 flex py-1 items-center justify-center cursor-pointer hover:bg-primary/15"
                onClick={() => setEditing(true)}
              >
                <PencilLine className="mr-3 size-6" strokeWidth="1.5" />
                <p className="text-sm mr-1">修改</p>
              </div>
              <div
                className="w-full h-11 flex py-1 items-center justify-center cursor-pointer hover:bg-primary/15"
                onClick={() => onDelete(commentId)}
              >
                <Trash2 className="mr-3 size-6" strokeWidth="1.5" />
                <p className="text-sm mr-1">删除</p>
              </div>
            </>
          ) : (
            <div className="w-full h-11 flex py-1 items-center justify-center cursor-pointer hover:bg-primary/15">
              <Flag className="mr-3 size-6" strokeWidth="1.5" />
              <p className="text-sm mr-1">举报</p>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}