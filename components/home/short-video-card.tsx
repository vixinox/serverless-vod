'use client'

import { useRouter } from "next/navigation";
import type { GalleryVideoData as VideoData } from "@/lib/server/videos";
import { formatRelativeTime } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "../smart-image";

export function ShortVideoCard({ data }: { data?: VideoData | undefined }) {
  const router = useRouter();
  if (!data) return (
    <div className="flex-1">
      <Skeleton className="w-full aspect-2/3 rounded-xl"/>
      <div className="w-full mt-2 space-y-2">
        <Skeleton className="h-5 w-full"/>
        <Skeleton className="h-4 w-3/4"/>
      </div>
    </div>
  );

  return (
    <div className="relative flex-1 cursor-pointer group" onClick={() => router.push(`/watch/${data.shortCode}`)}>
      <div className="
        absolute inset-0 rounded-xl bg-transparent z-0
        transform scale-100 transition duration-300 ease-out
        group-hover:scale-104 group-hover:bg-foreground/20 origin-center
      "/>

      <div className="w-full aspect-2/3 rounded-xl overflow-hidden">
        <SmartImage src={data.thumbnail} alt=""/>
      </div>

      <div className="w-full mt-2">
        <p className="font-bold">{data.title}</p>
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
  )
}
