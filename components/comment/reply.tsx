'use client'

import { CommentContent } from "@/components/comment/comment-content";
import { CommentActions } from "@/components/comment/comment-actions";
import { useState } from "react";
import { CommentTextarea } from "@/components/comment/comment-textarea";
import { ReactionType } from "@prisma/client";
import type { ReplyData } from "@/lib/server/comments";

interface ReplyProps {
  data: ReplyData;
  onSubmit: (content: string) => void;
  onDelete: (replyId: string) => void;
  onEdit: (replyId: string, content: string) => void;
  toggleReaction: (replyId: string, reaction?: ReactionType) => void;
}

export function Reply({ data, onSubmit, onDelete, onEdit, toggleReaction }: ReplyProps) {
  const [isEditing, setEditing] = useState(false);
  const [showTextarea, setShowTextarea] = useState(false);

  return (
    <div className="w-full space-y-1 relative mb-4">
      <CommentContent
        size="small"
        commentId={data.replyId}
        image={data.image}
        name={data.name}
        content={data.content}
        createdAt={data.createdAt}
        isEditing={isEditing}
        setEditing={setEditing}
        onEdit={onEdit}
      />
      <CommentActions
        userId={data.userId}
        commentId={data.replyId}
        likesCount={data.likesCount}
        prevReaction={data.prevReaction}
        toggleReaction={toggleReaction}
        onDelete={onDelete}
        setEditing={setEditing}
        isEditing={isEditing}
        showTextarea={setShowTextarea}
      />
      {showTextarea && (
        <CommentTextarea
          onSubmit={onSubmit}
          mode="reply"
          visible={showTextarea}
          onCancel={() => setShowTextarea(false)}
        />
      )}
    </div>
  );
}
