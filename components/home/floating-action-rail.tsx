"use client";

import {
  Home,
  Search,
  Bookmark,
  History,
  Clock,
  Moon,
  Sun,
  Settings,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePageTransition } from "@/components/transition/transition-context";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SettingsDialogContent } from "@/components/settings/settings-dialog-content";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/use-settings";

type NavTabItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  targetPath?: string;
  selectable?: boolean;
  action?: "toggle-theme" | "refresh" | "open-settings";
};

type NavTabSection = {
  id: string;
  items: NavTabItem[];
};

const PRIMARY_NAV_ITEMS: NavTabItem[] = [
  { id: "home", label: "首页", icon: Home, targetPath: "/", selectable: true },
  { id: "search", label: "搜索", icon: Search, targetPath: "/search", selectable: true },
  { id: "saved", label: "收藏", icon: Bookmark, targetPath: "/saved", selectable: true },
  { id: "history", label: "历史记录", icon: History, targetPath: "/history", selectable: true },
  {
    id: "watch-later",
    label: "稍后再看",
    icon: Clock,
    targetPath: "/saved?list=wl",
    selectable: true,
  },
];

const SECONDARY_NAV_ITEMS: NavTabItem[] = [
  {
    id: "settings",
    label: "个人设置",
    icon: Settings,
    action: "open-settings",
  },
  { id: "refresh", label: "刷新", icon: RefreshCw, action: "refresh" },
];

function NavTabButton({
  item,
  isActive,
  onPress,
}: {
  item: NavTabItem;
  isActive: boolean;
  onPress: (item: NavTabItem) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={item.label}
          aria-pressed={item.selectable ? isActive : undefined}
          onClick={() => onPress(item)}
          className={cn(
            "relative w-11 h-11 p-2.5 cursor-pointer rounded-full border bg-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.24),0_10px_18px_-14px_rgba(0,0,0,0.78)] transition duration-150 ease-out hover:scale-110 hover:border-white/18 active:scale-90 dark:bg-zinc-700",
            isActive ? "border-white/90" : "border-white/8"
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,1),0_0_0_1px_rgba(255,255,255,0.52),0_12px_24px_-8px_rgba(255,255,255,0.48)] transition duration-220 ease-out",
              isActive ? "opacity-100" : "opacity-0"
            )}
          />
          <item.icon
            aria-hidden="true"
            className={cn(
              "relative z-10 transition duration-220 size-full",
              isActive ? "text-black" : "text-white"
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" sideOffset={14}>
        <p>{item.label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function FloatingActionRail() {
  const { resolvedTheme, setTheme } = useTheme();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { startFadeTransition } = usePageTransition();
  const { flushToDB } = useSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const resolvedActivePath =
    pathname === "/saved" && searchParams.get("list") === "wl"
      ? "/saved?list=wl"
      : pathname;
  const [activePath, setActivePath] = useState(resolvedActivePath);

  useEffect(() => {
    setActivePath(resolvedActivePath);
  }, [resolvedActivePath]);

  const sections: NavTabSection[] = [
    {
      id: "primary",
      items: PRIMARY_NAV_ITEMS,
    },
    {
      id: "secondary",
      items: [
        {
          id: "theme",
          label: mounted
            ? resolvedTheme === "dark"
              ? "浅色模式"
              : "深色模式"
            : "切换主题",
          icon: mounted && resolvedTheme === "dark" ? Sun : Moon,
          action: "toggle-theme",
        },
        ...SECONDARY_NAV_ITEMS,
      ],
    },
  ];

  const handlePress = (item: NavTabItem) => {
    if (item.action === "toggle-theme") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
      return;
    }

    if (item.action === "refresh") {
      router.refresh();
      return;
    }

    if (item.action === "open-settings") {
      setSettingsOpen(true);
      return;
    }

    if (item.selectable && item.targetPath) {
      if (item.targetPath === activePath) {
        return;
      }

      setActivePath(item.targetPath);
      startFadeTransition(item.targetPath, { maskMode: "keep-home-rail" });
    }
  };

  return (
    <>
      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (!open) {
            flushToDB();
          }
        }}
      >
        <SettingsDialogContent />
      </Dialog>

      <div className="relative px-2 py-3 isolate flex flex-col rounded-full border border-white/10 bg-zinc-100/90 shadow-[0_0_0_1px_rgba(255,255,255,0.4),0_0_2px_1px_rgba(255,255,255,0.3),0_0_4px_2px_rgba(255,255,255,0.2)] backdrop-blur-xl dark:bg-zinc-900/94 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_0_2px_1px_rgba(255,255,255,0.15),0_0_4px_2px_rgba(255,255,255,0.08)]">
        <div className="relative z-10 flex flex-col">
          {sections.map((section, index) => (
            <div key={section.id}>
              <div className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <NavTabButton
                    key={item.id}
                    item={item}
                    isActive={Boolean(item.selectable && item.targetPath === activePath)}
                    onPress={handlePress}
                  />
                ))}
              </div>
              {index < sections.length - 1 && <Separator className="my-4 bg-muted-foreground/50" />}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
