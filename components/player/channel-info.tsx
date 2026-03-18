'use client';

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toggleSubscribe } from "@/actions/channel/toggle-subscribe";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

function formatSubscribersCount(count: number) {
  if (count >= 10000) {
    return `${(count / 10000).toFixed(1).replace(".0", "")}万位订阅者`;
  }

  return `${count}位订阅者`;
}

export function ChannelInfo({
  channelId,
  name,
  image,
  subscribersCount,
  initialIsSubscribed,
  isOwner,
}: {
  channelId: string;
  name: string;
  image?: string | null;
  subscribersCount: number;
  initialIsSubscribed: boolean;
  isOwner: boolean;
}) {
  const [isSubscribed, setIsSubscribed] = useState(initialIsSubscribed);
  const [localSubscribersCount, setLocalSubscribersCount] = useState(subscribersCount);
  const [isPending, startTransition] = useTransition();

  const handleSubscribe = () => {
    if (isOwner) {
      return;
    }

    const previousSubscribed = isSubscribed;
    const previousSubscribersCount = localSubscribersCount;
    const nextSubscribed = !isSubscribed;
    const nextSubscribersCount = Math.max(
      0,
      localSubscribersCount + (nextSubscribed ? 1 : -1),
    );

    setIsSubscribed(nextSubscribed);
    setLocalSubscribersCount(nextSubscribersCount);

    startTransition(async () => {
      try {
        const result = await toggleSubscribe(channelId);
        setIsSubscribed(result.isSubscribed);
      } catch (error) {
        setIsSubscribed(previousSubscribed);
        setLocalSubscribersCount(previousSubscribersCount);
        toast.error(error instanceof Error ? error.message : "订阅失败");
      }
    });
  };

  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarImage src={image ?? undefined} />
        <AvatarFallback className="bg-[#33691e] text-lg">{name.charAt(0) || "U"}</AvatarFallback>
      </Avatar>
      <div>
        <p className="font-bold">{name}</p>
        <p className="text-xs text-muted-foreground">
          {formatSubscribersCount(localSubscribersCount)}
        </p>
      </div>
      <Button
        className="rounded-full cursor-pointer ml-6"
        variant={isSubscribed ? "secondary" : "default"}
        disabled={isOwner || isPending}
        onClick={handleSubscribe}
      >
        {isOwner ? "我的频道" : isSubscribed ? "已订阅" : "订阅"}
      </Button>
    </div>
  );
}
