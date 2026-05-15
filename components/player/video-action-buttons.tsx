'use client'

import { ReactionType } from "@prisma/client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bookmark, ClockPlus, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client";
import {
  FAVORITES_PLAYLIST_KEY,
  FAVORITES_PLAYLIST_TITLE,
  type SystemPlaylistKey,
  WATCH_LATER_PLAYLIST_KEY,
  WATCH_LATER_PLAYLIST_TITLE,
} from "@/lib/system-playlists";

interface VideoActionButtonProps {
  shortCode: string;
  likesCount: number;
  prevReaction: ReactionType | undefined;
  isWatchLater: boolean;
  isFavorited: boolean;
}

export function VideoActionButtons({
  shortCode,
  likesCount,
  prevReaction,
  isWatchLater,
  isFavorited,
}: VideoActionButtonProps) {
  const [reaction, setReaction] = useState(prevReaction);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [watchLater, setWatchLater] = useState(isWatchLater);
  const [favorited, setFavorited] = useState(isFavorited);
  const [isReactionPending, startReactionTransition] = useTransition();
  const [isPlaylistPending, startPlaylistTransition] = useTransition();

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

  const handleSystemPlaylistToggle = (playlistKey: SystemPlaylistKey) => {
    const isWatchLaterTarget = playlistKey === WATCH_LATER_PLAYLIST_KEY;
    const previousValue = isWatchLaterTarget ? watchLater : favorited;
    const setValue = isWatchLaterTarget ? setWatchLater : setFavorited;

    setValue(!previousValue);

    startPlaylistTransition(async () => {
      try {
        const result = await apiRequest<{ saved: boolean; playlistTitle: string }>(
          `/api/videos/${shortCode}/save`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              playlistKey,
            }),
          },
        );

        setValue(result.saved);
        toast.success(
          result.saved
            ? `已保存到${result.playlistTitle}`
            : `已从${result.playlistTitle}移除`,
        );
      } catch (error) {
        setValue(previousValue);
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
          disabled={isPlaylistPending}
          onClick={() => handleSystemPlaylistToggle(FAVORITES_PLAYLIST_KEY)}
          variant={favorited ? "default" : "secondary"}
        >
          <Bookmark />
          <p>{favorited ? "已收藏" : FAVORITES_PLAYLIST_TITLE}</p>
        </Button>

        <Button
          className="rounded-full shadow-none"
          disabled={isPlaylistPending}
          onClick={() => handleSystemPlaylistToggle(WATCH_LATER_PLAYLIST_KEY)}
          variant={watchLater ? "default" : "secondary"}
        >
          <ClockPlus />
          <p>{watchLater ? "已加入稍后再看" : WATCH_LATER_PLAYLIST_TITLE}</p>
        </Button>
      </div>
    </>
  );
}
