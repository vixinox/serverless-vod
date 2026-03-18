'use client'

import { ReactionType } from "@prisma/client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, ListVideo, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { putVideoReaction } from "@/actions/video/put-video-reaction";
import { toggleVideoSave } from "@/actions/playlist/toggle-video-save";

interface VideoActionButtonProps {
  videoId: string;
  likesCount: number;
  prevReaction: ReactionType | undefined;
  isSaved: boolean;
}

export function VideoActionButtons({
  videoId,
  likesCount,
  prevReaction,
  isSaved,
}: VideoActionButtonProps) {
  const [reaction, setReaction] = useState(prevReaction);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);
  const [saved, setSaved] = useState(isSaved);
  const [isReactionPending, startReactionTransition] = useTransition();
  const [isSavePending, startSaveTransition] = useTransition();

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
        const result = await putVideoReaction(videoId, resolvedReaction);
        setReaction(result.reaction);
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
        const result = await toggleVideoSave(videoId);
        setSaved(result.saved);
        toast.success(result.saved ? `已保存到${result.playlistTitle}` : "已从收藏中移除");
      } catch (error) {
        setSaved(previousSaved);
        toast.error(error instanceof Error ? error.message : "保存失败");
      }
    });
  };

  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-l-full"
            disabled={isReactionPending}
            onClick={() => handleReaction("LIKE")}
          >
            <ThumbsUp fill={reaction === "LIKE" ? "currentColor" : undefined}/>
            <p>
              {localLikesCount != null
                ? localLikesCount >= 10000
                  ? (localLikesCount / 10000).toFixed(1) + '万'
                  : localLikesCount
                : 0}
            </p>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">喜欢</TooltipContent>
      </Tooltip>

      <div className="w-px h-9 bg-foreground/30"/>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-r-full"
            disabled={isReactionPending}
            onClick={() => handleReaction("DISLIKE")}
          >
            <ThumbsDown fill={reaction === "DISLIKE" ? "currentColor" : undefined}/>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">不喜欢</TooltipContent>
      </Tooltip>

      <Button
        className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-full ml-3"
        onClick={handleShare}
      >
        <ExternalLink/>
        <p>分享</p>
      </Button>

      <Button
        className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-full ml-3"
        disabled={isSavePending}
        onClick={handleSave}
      >
        <ListVideo/>
        <p>{saved ? "已收藏" : "添加到"}</p>
      </Button>
    </div>
  );
}
