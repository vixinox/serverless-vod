'use client'

import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VideoInfoCardProps {
  filename?: string | null;
  shortCode: string;
  thumbnail: string | null;
}

export function VideoInfoCard({ filename, shortCode, thumbnail }: VideoInfoCardProps) {
  const presets = ["1080p", "720p", "360p"];
  const appOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const videoUrl = `${appOrigin}/watch/${shortCode}`;

  return (
    <Card className="p-0 overflow-hidden gap-0">

      {/* ── 视频链接 ── */}
      <div className="p-4 flex justify-between items-center gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">视频链接</p>
          <Link
            href={`/watch/${shortCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:underline text-sm break-all whitespace-normal"
          >
            {videoUrl}
          </Link>
        </div>
        <CopyButton title="复制视频链接" content={videoUrl} />
      </div>

      {/* ── 文件名 ── */}
      <div className="px-4 pb-4">
        <p className="text-xs text-muted-foreground">文件名</p>
        <p className="text-sm truncate">{filename ?? "—"}</p>
      </div>

      {/* ── 视频画质 ── */}
      <div className="px-4 pb-4 space-y-1.5">
        <p className="text-xs text-muted-foreground">视频画质</p>
        <div className="flex gap-2 flex-wrap">
          {presets.map((name) => (
            <Badge key={name}>{name}</Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}
