'use client';

import { ChangeEvent, memo, useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/lib/auth-client';

export type CommentMode = 'comment' | 'reply';

interface CommentTextareaProps {
  className?: string;
  mode?: CommentMode;
  isLoading?: boolean;
  visible?: boolean;
  onCancel?: () => void;
  onSubmit?: (content: string) => void;
}

export const CommentTextarea = memo(function CommentTextarea({
  className,
  mode = 'comment',
  onSubmit = () => {
  },
  isLoading = false,
  visible = false,
  onCancel = () => {
  },
}: CommentTextareaProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleCancel = () => {
    setIsEditing(false);
    setValue('');
    onCancel();
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
    setIsEditing(false);
    onCancel();
  };

  useEffect(() => {
    if (visible && mode === 'reply') textareaRef.current?.focus();
  }, [mode, visible]);

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    adjustHeight();
  };

  if (isLoading) {
    return (
      <div className="flex mt-4 gap-3">
        <Skeleton className="rounded-full size-10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-2 w-lg" />
        </div>
      </div>
    );
  }

  const avatarSize = mode === 'reply' ? 'size-6' : isEditing ? 'size-10' : 'size-6';

  return (
    <div
      className={clsx(
        'w-full flex flex-col',
        !visible && 'hidden',
        mode === 'reply' && 'pr-12',
        className
      )}
    >
      <div className="w-full flex gap-4 items-start mt-4">
        <Avatar className={avatarSize}>
          <AvatarImage src={user?.image ?? undefined} />
          <AvatarFallback className="bg-[#33691e] text-lg">{user?.name?.charAt(0) ?? "U"}</AvatarFallback>
        </Avatar>

        <div className="flex items-start w-full relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={handleInput}
            onFocus={() => setIsEditing(true)}
            placeholder="添加评论..."
            className="w-full outline-none resize-none overflow-hidden peer text-sm"
          />

          <div
            className={clsx('absolute -bottom-1.5 h-px bg-border rounded-full',
              mode === 'reply' ? 'w-[97%]' : 'w-[99%]'
            )}
          />

          <div
            className={clsx(
              'absolute -bottom-1.5 h-[1.5px] bg-primary rounded-full origin-center scale-x-0 transition-transform duration-300 ease-out peer-focus:scale-x-100',
              mode === 'reply' ? 'w-[97%]' : 'w-[99%]'
            )}
          />
        </div>
      </div>

      {(isEditing && visible) && (
        <div className={clsx('flex w-full justify-end gap-2 pr-4', mode === 'reply' && 'mt-4')}>
          <Button
            className="rounded-full cursor-pointer"
            variant="ghost"
            onClick={handleCancel}
          >
            取消
          </Button>
          <Button
            className="rounded-full cursor-pointer"
            disabled={!value.trim()}
            onClick={handleSubmit}
          >
            {mode === "comment" ? "评论" : "回复"}
          </Button>
        </div>
      )}
    </div>
  );
});