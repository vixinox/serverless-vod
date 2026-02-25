'use client';

import { CommentData } from "@/actions/comment/get-comments";
import { CommentContent } from "@/components/comment/comment-content";
import { CommentActions } from "@/components/comment/comment-actions";
import { useState } from "react";
import { CommentReplies } from "@/components/comment/comment-replies";
import { CommentTextarea } from "@/components/comment/comment-textarea";
import { ReactionType } from "@prisma/client";

interface CommentProps {
  comment: CommentData;
  onDelete: (commentId: string) => void;
  onEdit: (commentId: string, content: string) => void;
  onReplySubmit: (content: string) => void;
  toggleReaction: (commentId: string, reaction?: ReactionType) => void;
}

export function Comment({ comment, onDelete, onEdit, onReplySubmit, toggleReaction }: CommentProps) {
  const [isEditing, setEditing] = useState(false);
  const [showTextarea, setShowTextarea] = useState(false);

  return (
    <div className="w-full space-y-1 relative">
      <CommentContent
        commentId={comment.commentId}
        image={comment.image}
        name={comment.name}
        content={comment.content}
        createdAt={comment.createdAt}
        isEditing={isEditing}
        setEditing={setEditing}
        onEdit={onEdit}
      />
      <CommentActions
        userId={comment.userId}
        commentId={comment.commentId}
        likesCount={comment.likesCount}
        prevReaction={comment.prevReaction}
        onDelete={onDelete}
        setEditing={setEditing}
        isEditing={isEditing}
        showTextarea={setShowTextarea}
        toggleReaction={toggleReaction}
      />
      {showTextarea && (
        <CommentTextarea
          className="ml-12"
          onSubmit={onReplySubmit}
          mode="reply"
          visible={showTextarea}
          onCancel={() => setShowTextarea(false)}
        />
      )}
      <CommentReplies
        commentId={comment.commentId}
        repliesCount={comment.repliesCount}
      />
    </div>
  );
}