'use client'

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatRelativeTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { VideoData } from "@/actions/video/get-videos";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartImage } from "../smart-image";

export function VideoCard({ data }: { data?: VideoData | undefined }) {
  const router = useRouter();

  if (!data) return (
    <div className="relative flex-1">
      <div className="relative z-10">
        <Skeleton className="w-full aspect-video rounded-xl"/>
        <div className="flex justify-start items-start w-full mt-2">
          <Skeleton className="w-9 h-9 rounded-full"/>
          <div className="w-full ml-3 space-y-2">
            <Skeleton className="h-5 w-3/4"/>
            <Skeleton className="h-4 w-1/2"/>
            <Skeleton className="h-4 w-2/3"/>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div
      className="relative flex-1 cursor-pointer group"
      onClick={() => router.push(`/watch/${data.shortCode}`)}
    >
      <div className="
        absolute inset-0 rounded-xl bg-transparent z-0
        transform scale-100 transition duration-300 ease-out
        group-hover:scale-104 group-hover:bg-foreground/20 origin-center
      "/>

      <div className="relative z-10">
        <div className="w-full aspect-video rounded-xl overflow-hidden">
          <SmartImage src={data.thumbnail} alt=""/>
        </div>
        <div className="flex justify-start items-start w-full mt-2">
          <Avatar className="w-9 h-9">
            <AvatarImage src={data.ownerImage} alt=""/>
            <AvatarFallback className="bg-[#33691e] text-lg">{data.ownerName?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="w-full ml-3">
            <p className="font-bold">{data.title}</p>
            <p className="text-sm text-muted-foreground">{data.ownerName}</p>
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
    </div>
  )
}