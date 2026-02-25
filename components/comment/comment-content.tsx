'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import { ChangeEvent, useRef, useState } from "react";
import clsx from "clsx";
import { Button } from "@/components/ui/button";

interface CommentHeaderProps {
  size?: "small" | "large";
  commentId: string;
  image: string | undefined;
  name: string;
  content: string;
  createdAt: Date;
  isEditing: boolean;
  setEditing: (isEditing: boolean) => void;
  onEdit: (commentId: string, content: string) => void;
}

export function CommentContent({
  size = "large",
  commentId,
  image,
  name,
  createdAt,
  content,
  isEditing = false,
  setEditing,
  onEdit,
}: CommentHeaderProps) {
  const [value, setValue] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    setValue(el.value);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  return (
    <div className="w-full flex gap-4 items-start">
      <Avatar className={size === "large" ? "size-10" : "size-6"}>
        <AvatarImage src={image} />
        <AvatarFallback className="bg-[#33691e] text-lg">{name?.charAt(0) ?? "U"}</AvatarFallback>
      </Avatar>

      {isEditing ? (
        <div className="w-full">
          <div className="flex items-start w-full relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={value}
              onChange={handleInput}
              placeholder="添加评论..."
              className="w-full outline-none resize-none overflow-hidden peer text-sm"
            />
            <div
              className={clsx('absolute -bottom-1.5 h-px bg-border rounded-full',
                size === 'small' ? 'w-[97%]' : 'w-[99%]'
              )}
            />
            <div
              className={clsx(
                'absolute -bottom-1.5 h-[1.5px] bg-primary rounded-full origin-center scale-x-0 transition-transform duration-300 ease-out peer-focus:scale-x-100',
                size === 'small' ? 'w-[97%]' : 'w-[99%]'
              )}
            />
          </div>

          <div className={clsx('flex w-full justify-end gap-2 pr-4 mt-5', size === 'small' && 'mt-4')}>
            <Button
              className="rounded-full cursor-pointer"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              取消
            </Button>
            <Button
              className="rounded-full cursor-pointer"
              disabled={value.trim() === content.trim()}
              onClick={() => {
                onEdit(commentId, value.trim());
                setEditing(false);
              }}
            >
              保存
            </Button>
          </div>
        </div>
      ) : (
        <div className="ml-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold">@{name}</p>
            <p className="text-sm text-muted-foreground">
              {formatRelativeTime(createdAt)}
            </p>
          </div>
          <p className="text-sm mt-1">{content}</p>
        </div>
      )}
    </div>
  );
}