"use client";

import { useEffect, useState } from "react";
import { Bookmark, ChevronRight, History } from "lucide-react";
import { SmartImage } from "@/components/smart-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTransition } from "@/components/transition/transition-context";
import { apiRequest } from "@/lib/api-client";
import { formatRelativeTime } from "@/lib/utils";

type PreviewKey = "saved" | "history";

type PreviewItem = {
  id: string;
  shortCode: string;
  title: string;
  thumbnail: string;
  ownerName: string;
  activityAt: string;
  activityLabel: string;
};

type PreviewResponse = {
  isAuthenticated: boolean;
  saved: {
    items: PreviewItem[];
  };
  history: {
    items: PreviewItem[];
  };
};

const PREVIEW_LINKS: Array<{
  key: PreviewKey;
  label: string;
  href: string;
  description: string;
  emptyText: string;
  authText: string;
  icon: typeof Bookmark;
}> = [
  {
    key: "saved",
    label: "收藏夹",
    href: "/saved",
    description: "快速看一眼最近加入收藏夹的视频。",
    emptyText: "你的收藏夹还是空的，先去收藏几条视频吧。",
    authText: "登录后就能在这里预览最近收藏的视频。",
    icon: Bookmark,
  },
  {
    key: "history",
    label: "历史记录",
    href: "/history",
    description: "继续接着看最近播放过的视频。",
    emptyText: "最近还没有观看记录，去首页挑一条开始吧。",
    authText: "登录后就能在这里预览最近看过的视频。",
    icon: History,
  },
];

function PreviewSkeleton() {
  return (
    <Card className="w-[22rem] gap-0 rounded-3xl border-border/70 py-0 shadow-xl">
      <CardHeader className="space-y-2 border-b border-border/60 pb-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="space-y-3 px-5 py-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 rounded-2xl border border-border/60 p-2">
            <Skeleton className="h-14 w-24 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PreviewCard({
  label,
  description,
  items,
  emptyText,
  authText,
  isAuthenticated,
}: {
  label: string;
  description: string;
  items: PreviewItem[];
  emptyText: string;
  authText: string;
  isAuthenticated: boolean;
}) {
  const message = !isAuthenticated ? authText : items.length === 0 ? emptyText : null;

  return (
    <Card className="w-[22rem] gap-0 rounded-3xl border-border/70 bg-background/95 py-0 shadow-xl backdrop-blur">
      <CardHeader className="space-y-2 border-b border-border/60 pb-4">
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription className="leading-5">{description}</CardDescription>
      </CardHeader>
      <CardContent className="px-5 py-4">
        {message ? (
          <p className="text-sm leading-6 text-muted-foreground">{message}</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-border/60 bg-muted/20 p-2"
              >
                <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-muted">
                  <SmartImage
                    src={item.thumbnail}
                    alt={item.title}
                    sizes="96px"
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-5">{item.title}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{item.ownerName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.activityLabel} · {formatRelativeTime(item.activityAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <span>悬停预览，点击按钮进入完整列表</span>
          <ChevronRight className="size-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export function NavbarPreviewLinks() {
  const { startFadeTransition } = usePageTransition();
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviewData() {
      try {
        const result = await apiRequest<PreviewResponse>("/api/navigation/previews");

        if (!cancelled) {
          setPreviewData(result);
        }
      } catch {
        if (!cancelled) {
          setPreviewData({
            isAuthenticated: false,
            saved: { items: [] },
            history: { items: [] },
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadPreviewData();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="hidden items-center gap-2 xl:flex">
      {PREVIEW_LINKS.map((link) => {
        const Icon = link.icon;
        const items = previewData?.[link.key].items ?? [];

        return (
          <div key={link.key} className="group relative">
            <Button
              type="button"
              variant="ghost"
              className="h-10 rounded-full px-3 text-sm"
              onClick={() =>
                startFadeTransition(link.href, { maskMode: "keep-home-navbar" })
              }
            >
              <Icon className="size-4" />
              <span>{link.label}</span>
            </Button>

            <div className="absolute right-0 top-full z-10002 hidden pt-3 group-hover:block group-focus-within:block">
              {isLoading ? (
                <PreviewSkeleton />
              ) : (
                <PreviewCard
                  label={link.label}
                  description={link.description}
                  items={items}
                  emptyText={link.emptyText}
                  authText={link.authText}
                  isAuthenticated={previewData?.isAuthenticated ?? false}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
