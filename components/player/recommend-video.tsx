'use client'
import { useState } from "react";
import { SmartImage } from "@/components/smart-image";
import { Skeleton } from "@/components/ui/skeleton";
import { usePageTransition } from "@/components/transition/transition-context";
import { Check, ClockPlus, ListVideo } from "lucide-react";
import { VideoData } from "@/actions/video/get-recommend-videos";
import { usePathname } from "next/navigation";
import { formatRelativeTime } from "@/lib/utils";

export function RecommendVideo({ data }: { data: VideoData }) {
  const [clickedButton, setClickedButton] = useState<string | null>(null);
  const pathname = usePathname();
  const { startFadeTransition } = usePageTransition();

  if (!data) {
    return (
      <div className="flex items-start w-full">
        <Skeleton className="relative w-75 aspect-video rounded-lg overflow-hidden"/>
        <div className="w-full h-full space-y-2 ml-2">
          <Skeleton className="h-4 w-3/4"/>
          <Skeleton className="h-3 w-1/2"/>
        </div>
      </div>
    );
  }

  const handleButtonClick = (btnName: string) => {
    setClickedButton(btnName);
    setTimeout(() => {
      setClickedButton(null);
    }, 1000);
  };

  const handleCardClick = () => {
    const href = `/watch/${data.shortCode}`;
    if (pathname === href) return;
    startFadeTransition(href, { maskMode: "keep-video" });
  };

  return (
    <div
      className="flex items-start w-full cursor-pointer group"
      onClick={handleCardClick}
    >
      <div className="relative w-75 aspect-video rounded-lg overflow-hidden">
        <SmartImage src={data.thumbnail} alt="video" className="object-cover" autoRetry/>

        <div className="
          absolute top-1 right-1 flex flex-col space-y-1
          opacity-0 translate-y-1
          group-hover:opacity-100 group-hover:translate-y-0
        ">
          <button
            type="button"
            className="w-8 h-8 backdrop-blur rounded-full flex items-center justify-center hover:bg-foreground/20"
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick("clock");
            }}
          >
            {clickedButton === "clock" ? <Check size={20}/> : <ClockPlus size={20}/>}
          </button>
          <button
            type="button"
            className="w-8 h-8 backdrop-blur rounded-full flex items-center justify-center hover:bg-foreground/20"
            onClick={(e) => {
              e.stopPropagation();
              handleButtonClick("list");
            }}
          >
            {clickedButton === "list" ? <Check size={20}/> : <ListVideo size={20}/>}
          </button>
        </div>
      </div>

      <div className="w-full h-full flex flex-col justify-between space-y-2 ml-2">
        <div className="h-1/2 text-sm font-bold">
          {data.title}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{data.ownerName}</p>
          <p className="text-sm text-muted-foreground">
            {(() => {
              const views = Number(data.views);
              if (views >= 10000) {
                const display = (views / 10000).toFixed(1).replace('.0', '');
                return `${display}万 次观看 · ${formatRelativeTime(data.createdAt)}`;
              }
              return `${views} 次观看 · ${formatRelativeTime(data.createdAt)}`;
            })()}
          </p>
        </div>
      </div>
    </div>
  );
}