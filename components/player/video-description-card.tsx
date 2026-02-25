'use client'
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoDescriptionCardProps {
  description?: string | null;
  children: ReactNode;
  views: bigint;
  createdAt: Date;
}

export function VideoDescriptionCard({ description, children, views, createdAt }: VideoDescriptionCardProps) {
  const [open, setOpen] = useState(false);

  const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div
      className={cn(
        "w-full rounded-xl bg-foreground/15 px-3 py-3 mt-2 transition",
        open ? "" : "cursor-pointer hover:bg-foreground/25",
      )}
      onClick={() => {
        if (open) return;
        setOpen(!open);
      }}
    >
      <p className="text-sm font-bold">
        {views}次观看 {formatter.format(createdAt)}
      </p>

      <div className={cn(
        "whitespace-pre-wrap text-sm",
        open ? "" : "line-clamp-3"
      )}>
        {description}
      </div>

      {open && (
        <>
          <div className="mt-6">
            {children}
          </div>
          <p
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="cursor-pointer ml-2 w-fit text-sm mt-8 mb-1"
          >
            收起
          </p>
        </>
      )}
    </div>
  )
}