import { Skeleton } from "@/components/ui/skeleton";

export default function VideoEditLoading() {
  return (
    <div className="flex min-w-248">
      {/* Left column – title, description, thumbnail */}
      <div className="p-4.5 ml-1.5 space-y-5 min-w-160">
        <Skeleton className="h-8 w-48" />

        {/* Title textarea */}
        <Skeleton className="h-16 w-full" />

        {/* Description textarea */}
        <Skeleton className="h-44 w-full" />

        {/* Thumbnail */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-36 w-64 rounded" />
        </div>
      </div>

      {/* Right column – actions + preview + info card */}
      <div className="p-4.5 w-88 space-y-6">
        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <Skeleton className="h-9 w-20 rounded-full" />
          <Skeleton className="h-9 w-14 rounded-full" />
          <Skeleton className="h-9 w-14 rounded-full" />
        </div>

        {/* Video player preview */}
        <Skeleton className="w-full aspect-video rounded-xl" />

        {/* Info card */}
        <Skeleton className="h-24 w-full rounded-lg" />

        {/* Visibility card */}
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    </div>
  );
}
