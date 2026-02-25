'use client'

import { ReactionType } from "@prisma/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, ListVideo, ThumbsDown, ThumbsUp } from "lucide-react";
// import { putVideoReaction } from "@/actions/reaction/put-video-reaction";

interface VideoActionButtonProps {
  videoId: string;
  likesCount: number;
  prevReaction: ReactionType | undefined;
}

export function VideoActionButtons({ videoId, likesCount, prevReaction }: VideoActionButtonProps) {
  const [reaction, setReaction] = useState(prevReaction);
  const [localLikesCount, setLocalLikesCount] = useState(likesCount);

  return (
    <div className="flex items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-l-full"
            onClick={() => {
              setReaction(reaction === "LIKE" ? undefined : "LIKE");
              setLocalLikesCount(reaction === "LIKE" ? localLikesCount - 1 : localLikesCount + 1);
              // putVideoReaction(videoId, reaction === "LIKE" ? undefined : "LIKE")
            }}
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
            onClick={() => {
              setReaction(reaction === "DISLIKE" ? undefined : "DISLIKE")
              setLocalLikesCount(reaction === "LIKE" ? localLikesCount - 1 : localLikesCount);
              // putVideoReaction(videoId, reaction === "DISLIKE" ? undefined : "DISLIKE")
            }}
          >
            <ThumbsDown fill={reaction === "DISLIKE" ? "currentColor" : undefined}/>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">不喜欢</TooltipContent>
      </Tooltip>

      <Button className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-full ml-3">
        <ExternalLink/>
        <p>分享</p>
      </Button>

      <Button className="bg-[#2C2B2C] hover:bg-[#434243] text-foreground flex cursor-pointer rounded-full ml-3">
        <ListVideo/>
        <p>添加到</p>
      </Button>
    </div>
  );
}