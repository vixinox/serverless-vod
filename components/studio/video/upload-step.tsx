'use client'

import { cn } from "@/lib/utils";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InputHTMLAttributes } from "react";
import type { UploadState } from "@/hooks/use-video-upload";

// SVG 进度环参数（基于 100×100 viewBox）
const RING_RADIUS = 40;
const RING_STROKE = 4;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 251.3

const STATUS_MESSAGES: Partial<Record<UploadState["status"], string>> = {
  uploading: "上传中，请勿关闭页面…",
  finalizing: "正在提交转码任务…",
};

interface UploadStepProps {
  getInputProps: () => InputHTMLAttributes<HTMLInputElement>;
  open: () => void;
  isDragActive: boolean;
  uploadState: UploadState;
}

export function UploadStep({
  getInputProps,
  open,
  isDragActive,
  uploadState,
}: UploadStepProps) {
  const isActive =
    uploadState.status === "uploading" || uploadState.status === "finalizing";

  const progress =
    uploadState.status === "uploading" ? uploadState.progress : 0;

  const ringOffset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <div className="flex-1 flex flex-col justify-center items-center gap-6 px-6">
      <input {...getInputProps()} />

      {/* ── 上传图标 + 进度环（relative 容器确保 SVG overlay 正确定位）── */}
      <div
        role={isActive ? undefined : "button"}
        aria-disabled={isActive}
        onClick={() => !isActive && open()}
        className={cn(
          "relative size-32 rounded-full flex items-center justify-center",
          "bg-studio-background brightness-80 border-2 transition",
          isDragActive ? "border-blue-500" : "border-transparent",
          isActive
            ? "opacity-60 cursor-not-allowed"
            : "opacity-100 cursor-pointer hover:opacity-80",
        )}
      >
        {/* 进度环 SVG —— 绝对覆盖，不逃逸父容器 */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          aria-hidden
        >
          {/* 轨道圆 */}
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={RING_STROKE}
          />
          {/* 进度弧 */}
          <circle
            cx="50"
            cy="50"
            r={RING_RADIUS}
            fill="none"
            stroke="#00d600"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
            transform="rotate(-90 50 50)"
            style={{ transition: "stroke-dashoffset 0.3s ease" }}
          />
        </svg>

        <Upload className="size-1/2 brightness-75" />
      </div>

      {/* ── 说明文字 ── */}
      <div className="text-center space-y-1">
        <p>将要上传的视频文件拖放到此处</p>
        <p className="text-sm text-muted-foreground">
          你的视频在发布之前将处于私享状态
        </p>
      </div>

      {/* ── 操作区 ── */}
      {!isActive && (
        <Button className="rounded-full font-medium" onClick={open}>
          上传视频
        </Button>
      )}

      {/* ── 进度提示 ── */}
      {isActive && (
        <p className="text-sm text-muted-foreground animate-pulse">
          {STATUS_MESSAGES[uploadState.status]}
          {uploadState.status === "uploading" && ` ${progress}%`}
        </p>
      )}

      {/* ── 错误提示 ── */}
      {uploadState.status === "error" && (
        <p className="text-sm text-destructive">{uploadState.message}</p>
      )}
    </div>
  );
}