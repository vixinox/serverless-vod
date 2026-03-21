'use client'

import { ReactionType } from "@prisma/client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ClockPlus, ListVideo, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import { SaveToPlaylistDialog } from "@/components/player/save-to-playlist-dialog";
import { QUICK_SAVE_PLAYLIST_TITLE } from "@/lib/system-playlists";

interface VideoActionButtonProps {
  shortCode: string;
  likesCount: number;
  prevReaction: ReactionType | undefined;
  isSaved: boolean;
}

export function VideoActionButtons({
  shortCode,
  likesCount,
  prevReaction,
  isSaved,
}: VideoActionButtonProps) {
  const [reaction, setReaction] = useState(prevReaction);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [saved, setSaved] = useState(isSaved);
  const [isReactionPending, startReactionTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleReaction = (nextReaction: ReactionType) => {
    const previousReaction = reaction;
    const previousLikesCount = localLikesCount;
    const resolvedReaction = reaction === nextReaction ? undefined : nextReaction;
    let nextLikesCount = previousLikesCount;

    if (previousReaction === "LIKE") {
      nextLikesCount -= 1;
    }

    if (resolvedReaction === "LIKE") {
      nextLikesCount += 1;
    }

    setReaction(resolvedReaction);
    setLocalLikesCount(Math.max(0, nextLikesCount));

    startReactionTransition(async () => {
      try {
        const result = await apiRequest<{ reaction?: ReactionType; likesCount: number }>(
          `/api/videos/${shortCode}/reaction`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ reactionType: resolvedReaction ?? null }),
          },
        );
        setReaction(result.reaction);
        setLocalLikesCount(result.likesCount);
      } catch (error) {
        setReaction(previousReaction);
        setLocalLikesCount(previousLikesCount);
        toast.error(error instanceof Error ? error.message : "操作失败");
      }
    });
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("链接已复制");
    } catch {
      toast.error("复制链接失败");
    }
  };

  const handleSave = () => {
    const previousSaved = saved;
    const nextSaved = !saved;

    setSaved(nextSaved);

    startSaveTransition(async () => {
      try {
        const result = await apiRequest<{ saved: boolean; playlistTitle: string }>(
          `/api/videos/${shortCode}/save`,
          {
            method: "POST",
          },
        );
        setSaved(result.saved);
        toast.success(result.saved ? `已保存到${result.playlistTitle}` : "已从收藏中移除");
      } catch (error) {
        setSaved(previousSaved);
        toast.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center overflow-hidden rounded-full bg-secondary text-secondary-foreground">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="rounded-none rounded-l-full shadow-none"
                disabled={isReactionPending}
                onClick={() => handleReaction("LIKE")}
                variant="secondary"
              >
                <ThumbsUp fill={reaction === "LIKE" ? "currentColor" : undefined} />
                <p>
                  {localLikesCount != null
                    ? localLikesCount >= 10000
                      ? (localLikesCount / 10000).toFixed(1) + "万"
                      : localLikesCount
                    : 0}
                </p>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">喜欢</TooltipContent>
          </Tooltip>

          <div className="h-9 w-px bg-border" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                className="rounded-none rounded-r-full shadow-none"
                disabled={isReactionPending}
                onClick={() => handleReaction("DISLIKE")}
                variant="secondary"
              >
                <ThumbsDown fill={reaction === "DISLIKE" ? "currentColor" : undefined} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">不喜欢</TooltipContent>
          </Tooltip>
        </div>

        <Button className="rounded-full shadow-none" onClick={handleShare} variant="secondary">
          <Share2 />
          <p>分享</p>
        </Button>

        <Button
          className="rounded-full shadow-none"
          disabled={isSavePending}
          onClick={handleSave}
          variant={saved ? "default" : "secondary"}
        >
          <ClockPlus />
          <p>{saved ? "已收藏" : QUICK_SAVE_PLAYLIST_TITLE}</p>
        </Button>

        <Button
          className="rounded-full shadow-none"
          onClick={() => setDialogOpen(true)}
          variant="secondary"
        >
          <ListVideo />
          <p>添加到</p>
        </Button>
      </div>

      <SaveToPlaylistDialog open={dialogOpen} onOpenChange={setDialogOpen} shortCode={shortCode} />
    </>
  );
}
