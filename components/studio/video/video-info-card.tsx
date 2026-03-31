'use client'

import Link from "next/link";
import { VideoProcessingStatus } from "@prisma/client";
import { CopyButton } from "@/components/copy-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VideoInfoCardProps {
  shortCode: string;
  processingStatus: VideoProcessingStatus;
  processingError?: string | null;
  qualityPresets?: string[];
}

const processingStatusCopy: Record<VideoProcessingStatus, string> = {
  UPLOADING: "视频上传中，转码完成后会显示可用画质。",
  PROCESSING: "正在处理视频，画质信息会在转码完成后出现。",
  READY: "当前视频已经可以播放。",
  FAILED: "处理失败，请检查错误信息后重试。",
};

export function VideoInfoCard({
  shortCode,
  processingStatus,
  processingError,
  qualityPresets,
}: VideoInfoCardProps) {
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

      {/* ── 视频画质 ── */}
      <div className="px-4 pb-4 space-y-1.5">
        <p className="text-xs text-muted-foreground">视频画质</p>
        {processingStatus === VideoProcessingStatus.READY && qualityPresets && qualityPresets.length > 0 ? (
          <div className="flex gap-2 flex-wrap">
            {qualityPresets.map((name) => (
              <Badge key={name}>{name}</Badge>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground italic">
              {processingStatusCopy[processingStatus]}
            </p>
            {processingStatus === VideoProcessingStatus.FAILED && processingError ? (
              <p className="text-xs text-destructive break-all">{processingError}</p>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
