'use client'

import Link from "next/link";
import Image from "next/image";
import { CopyButton } from "@/components/copy-button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { VideoIcon } from "lucide-react";

interface VideoInfoCardProps {
  filename?: string | null;
  shortCode: string;
  thumbnail: string | null;
}

export function VideoInfoCard({ filename, shortCode, thumbnail }: VideoInfoCardProps) {
  const presets = ["1080p", "720p", "360p"];
  // 使用浏览器 origin，避免硬编码 localhost:3000
  const appOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const videoUrl = `${appOrigin}/watch/${shortCode}`;

  return (
    <Card className="p-0 overflow-hidden gap-0">
      {/* ── 缩略图预览 ── */}
      <CardContent className="w-full aspect-video p-0 overflow-hidden bg-muted flex items-center justify-center">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt="缩略图预览"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <VideoIcon className="size-10 text-muted-foreground opacity-40" />
        )}
      </CardContent>

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
