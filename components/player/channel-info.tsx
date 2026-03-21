'use client';

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api-client";
import { usePageTransition } from "@/components/transition/transition-context";
import { cn } from "@/lib/utils";

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
  href,
  size = "compact",
}: {
  channelId: string;
  name: string;
  image?: string | null;
  subscribersCount: number;
  initialIsSubscribed: boolean;
  isOwner: boolean;
  href?: string;
  size?: "compact" | "hero";
}) {
  const [isSubscribed, setIsSubscribed] = useState(initialIsSubscribed);
  const [localSubscribersCount, setLocalSubscribersCount] = useState(subscribersCount);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const { startFadeTransition } = usePageTransition();

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
        const result = await apiRequest<{ isSubscribed: boolean; subscribersCount: number }>(
          `/api/channels/${channelId}/subscription`,
          {
            method: "POST",
          },
        );
        setIsSubscribed(result.isSubscribed);
        setLocalSubscribersCount(result.subscribersCount);
      } catch (error) {
        setIsSubscribed(previousSubscribed);
        setLocalSubscribersCount(previousSubscribersCount);
        toast.error(error instanceof Error ? error.message : "订阅失败");
      }
    });
  };

  const handleNavigate = () => {
    if (!href || pathname === href) {
      return;
    }

    startFadeTransition(href, { maskMode: "keep-video" });
  };

  const avatarSizeClass = size === "hero" ? "size-20 sm:size-24" : "size-10";
  const titleClassName = size === "hero" ? "text-2xl sm:text-3xl" : "text-base";
  const containerClassName =
    size === "hero"
      ? "flex flex-1 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      : "flex items-center gap-3";
  const profileClassName =
    size === "hero"
      ? "flex items-center gap-4 text-left transition-opacity hover:opacity-90"
      : "flex items-center gap-3 text-left transition-opacity hover:opacity-90";

  return (
    <div className={containerClassName}>
      {href ? (
        <button
          type="button"
          className={profileClassName}
          onClick={handleNavigate}
        >
          <Avatar className={avatarSizeClass}>
            <AvatarImage src={image ?? undefined} />
            <AvatarFallback className="bg-[#33691e] text-lg">{name.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className={cn("font-bold", titleClassName)}>{name}</p>
            <p className={cn("text-muted-foreground", size === "hero" ? "text-sm sm:text-base" : "text-xs")}>
              {formatSubscribersCount(localSubscribersCount)}
            </p>
          </div>
        </button>
      ) : (
        <div className={size === "hero" ? "flex items-center gap-4" : "flex items-center gap-3"}>
          <Avatar className={avatarSizeClass}>
            <AvatarImage src={image ?? undefined} />
            <AvatarFallback className="bg-[#33691e] text-lg">{name.charAt(0) || "U"}</AvatarFallback>
          </Avatar>
          <div>
            <p className={cn("font-bold", titleClassName)}>{name}</p>
            <p className={cn("text-muted-foreground", size === "hero" ? "text-sm sm:text-base" : "text-xs")}>
              {formatSubscribersCount(localSubscribersCount)}
            </p>
          </div>
        </div>
      )}
      <Button
        className={cn("cursor-pointer rounded-full", size === "hero" ? "w-fit" : "ml-6")}
        variant={isSubscribed ? "secondary" : "default"}
        disabled={isOwner || isPending}
        onClick={handleSubscribe}
      >
        {isOwner ? "我的频道" : isSubscribed ? "已订阅" : "订阅"}
      </Button>
    </div>
  );
}
