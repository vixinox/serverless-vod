'use client'
import { ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

interface VideoDescriptionCardProps {
  description?: string | null;
  children?: ReactNode;
  views: number;
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
        {(() => {
          const v = Number(views);  
          if (v >= 10000) {
            const display = (v / 10000).toFixed(1).replace('.0', '');
            return `${display}万 次观看`;
          }
          return `${v} 次观看`;
        })()} · {formatter.format(createdAt)}
      </p>

      {/* 描述文本：overflow clip，max-height 平滑伸缩，内容不被压缩 */}
      <div
        className="overflow-hidden whitespace-pre-wrap text-sm transition-[max-height] duration-150 ease-in-out"
        style={{ maxHeight: open ? '600px' : '4.5em' }}
      >
        {description}
      </div>

      {/* 附加内容：grid-template-rows 动画，内容不被压缩 */}
      <div
        className="grid transition-[grid-template-rows] duration-150 ease-in-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          {children && (
            <div className="mt-6">
              {children}
            </div>
          )}
          <p
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            className="cursor-pointer ml-2 w-fit text-sm mt-8 mb-1"
          >
            收起
          </p>
        </div>
      </div>
    </div>
  )
}
