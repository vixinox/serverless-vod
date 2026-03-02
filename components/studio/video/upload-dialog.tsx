'use client'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { type ReactNode, useCallback, useState, useEffect, useRef } from "react";
import {
  X, Check, Loader2, Upload, Copy, ArrowRight,
  RotateCcw, AlertTriangle, ChevronRight,
} from "lucide-react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { useVideoUpload, type UploadState } from "@/hooks/use-video-upload";
import type { PipelineStatus } from "@/actions/video/get-pipeline-status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

// ── Stage data model ─────────────────────────────────────────────────────────

type StageStatus = "idle" | "running" | "done" | "failed";

interface Stage {
  id: string;
  label: string;
  sublabel?: string;
  status: StageStatus;
  detail?: React.ReactNode;
  /** 0-100, rendered as progress bar when defined */
  progress?: number;
  elapsed?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(from: string | null, to: string | null): string {
  if (!from || !to) return "";
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const PIPELINE_STAGE_LABEL: Record<string, string> = {
  job_started:          "初始化作业",
  downloading:          "下载源视频",
  probing:              "探测视频元数据",
  transcoding:          "ffmpeg 转码中",
  uploading_segments:   "上传 HLS 切片",
  thumbnail_extracting: "提取封面帧",
  thumbnail_uploading:  "上传封面图",
};

// ── 派生任务阶段 ────────────────────────────────────────────────────────────────

function deriveStages(state: UploadState): Stage[] {
  if (state.status === "idle") return [];

  // 上传视频
  const uploadStage: Stage = {
    id: "upload",
    label: "上传视频",
    sublabel: "对象存储",
    status: state.status === "uploading" ? "running" : "done",
    progress: state.status === "uploading" ? state.progress : 100,
  };

  // 触发任务流
  const queueStage: Stage = {
    id: "queue",
    label: "触发任务流",
    sublabel: "状态机调度",
    status:
      state.status === "uploading"  ? "idle" :
      state.status === "finalizing" ? "running" : "done",
  };

  if (state.status === "uploading" || state.status === "finalizing") {
    return [uploadStage, queueStage];
  }

  if (state.status === "error") {
    return [
      { ...uploadStage, status: "done" },
      { ...queueStage, status: "failed" },
    ];
  }

  // state is "transcoding" or "done"
  const p: PipelineStatus =
    state.status === "transcoding"
      ? state.pipeline
      : {
          processingStatus: "READY",
          jobId: null, jobStatus: "SUCCEEDED",
          jobError: null, attempt: 0, maxAttempts: 3,
          pipelineStage: null, executionArn: null,
          inputKey: null, queuedAt: null, startedAt: null, finishedAt: null,
        };

  // Enrich queue stage with ARN
  const arnName = p.executionArn
    ? (p.executionArn.split(":").pop() ?? p.executionArn)
    : null;

  const enrichedQueue: Stage = {
    ...queueStage,
    detail: arnName ? (
      <span className="font-mono text-[10px] text-neutral-600 truncate block max-w-[32ch]">
        {arnName}
      </span>
    ) : undefined,
  };

  // 提取元数据
  const extractStatus: StageStatus =
    p.processingStatus === "FAILED" && !p.jobStatus ? "failed" :
    p.jobStatus === null ? "running" : "done";

  const extractStage: Stage = {
    id: "extract",
    label: "提取元数据",
    sublabel: "函数计算",
    status: extractStatus,
    detail: p.inputKey ? (
      <span className="font-mono text-[10px] text-neutral-600 break-all">{p.inputKey}</span>
    ) : undefined,
  };

  // 视频转码
  const tFailed = p.processingStatus === "FAILED" || p.jobStatus === "FAILED";
  const tDone   = p.jobStatus === "SUCCEEDED" || p.processingStatus === "READY";
  const transcodeStatus: StageStatus =
    tFailed ? "failed" :
    tDone   ? "done" :
    p.jobStatus === "RUNNING" ? "running" : "idle";

  const transcodeStage: Stage = {
    id: "transcode",
    label: "视频转码",
    sublabel:
      transcodeStatus === "running" && p.pipelineStage
        ? (PIPELINE_STAGE_LABEL[p.pipelineStage] ?? p.pipelineStage)
        : "函数计算 · ffmpeg → HLS",
    status: transcodeStatus,
    progress:
      transcodeStatus === "running" ? undefined :
      transcodeStatus === "done"    ? 100 : undefined,
    elapsed: formatElapsed(p.startedAt, p.finishedAt),
    detail: (p.attempt > 0 || p.jobError) ? (
      <div className="space-y-1.5 mt-0.5">
        {p.attempt > 0 && (
          <p className="text-[10px] text-neutral-600 font-mono">
            重试 {p.attempt}/{p.maxAttempts} 次
            {p.startedAt && (
              <span className="ml-2 opacity-50">
                开始于 {new Date(p.startedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        )}
        {p.jobError && (
          <div className="rounded-md bg-red-500/8 border border-red-500/15 px-2.5 py-2 text-[10px] text-red-400 font-mono leading-relaxed break-all">
            {p.jobError}
          </div>
        )}
      </div>
    ) : undefined,
  };

  // 写入资产
  const finalizeStatus: StageStatus =
    p.processingStatus === "READY"  ? "done" :
    p.processingStatus === "FAILED" ? "failed" :
    tDone ? "running" : "idle";

  const finalizeStage: Stage = {
    id: "finalize",
    label: "写入资产",
    sublabel: "函数计算 · 写入视频资产",
    status: finalizeStatus,
    elapsed: p.finishedAt ? new Date(p.finishedAt).toLocaleTimeString() : undefined,
  };

  return [uploadStage, enrichedQueue, extractStage, transcodeStage, finalizeStage];
}

// ── 总耗时计时器 ────────────────────────────────────────────────────────────────

function useDeployElapsed(active: boolean): string {
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setElapsed("");
      return;
    }
    if (startRef.current === null) startRef.current = Date.now();
    const id = setInterval(() => {
      if (!startRef.current) return;
      const s = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsed(`${s}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return elapsed;
}

// ── 任务状态标签 ───────────────────────────────────────────────────────────────

function DeployBadge({ state }: { state: UploadState }) {
  const isError =
    state.status === "error" ||
    (state.status === "transcoding" && state.pipeline.processingStatus === "FAILED");

  const label =
    state.status === "done" ? "就绪" :
    isError ? "错误" : "处理中";

  const ring =
    label === "就绪" ? "text-[#50e3c2] bg-[#50e3c2]/8 border-[#50e3c2]/20" :
    label === "错误" ? "text-red-400 bg-red-500/8 border-red-500/20" :
    "text-blue-400 bg-blue-500/8 border-blue-500/20";

  const dot =
    label === "处理中" ? "bg-blue-400 animate-pulse" :
    label === "就绪"   ? "bg-[#50e3c2]" : "bg-red-400";

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border", ring)}>
      <span className={cn("size-1.5 rounded-full shrink-0", dot)} />
      {label}
    </span>
  );
}

// ── Stage icon ────────────────────────────────────────────────────────────────

function StageIcon({ status }: { status: StageStatus }) {
  return (
    <div className={cn(
      "size-5 rounded-full flex items-center justify-center shrink-0 ring-1",
      status === "done"    && "bg-[#50e3c2]/10 text-[#50e3c2] ring-[#50e3c2]/25",
      status === "running" && "bg-blue-500/10 text-blue-400 ring-blue-500/25",
      status === "failed"  && "bg-red-500/10 text-red-400 ring-red-500/25",
      status === "idle"    && "bg-neutral-800/80 text-neutral-600 ring-neutral-700/50",
    )}>
      {status === "done"    && <Check         className="size-2.5" strokeWidth={3} />}
      {status === "running" && <Loader2       className="size-2.5 animate-spin" />}
      {status === "failed"  && <AlertTriangle className="size-2.5" />}
      {status === "idle"    && <span className="size-1.5 rounded-full bg-current" />}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, status }: { value: number; status: StageStatus }) {
  return (
    <div className="h-px w-full rounded-full bg-neutral-800 overflow-hidden mt-2.5">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-500",
          status === "failed" ? "bg-red-500" :
          value >= 100        ? "bg-[#50e3c2]" : "bg-blue-500",
        )}
        style={{ width: `${Math.max(3, value)}%` }}
      />
    </div>
  );
}

// ── Stage row ─────────────────────────────────────────────────────────────────

function StageRow({ stage }: { stage: Stage }) {
  const [open, setOpen] = useState(false);

  // "transcode" has expand toggle; others show detail inline
  const hasExpandable = stage.id === "transcode" && !!stage.detail;
  const hasInlineDetail =
    (stage.id === "queue" || stage.id === "extract") && !!stage.detail;

  return (
    <div className={cn(
      "px-5 py-3.5 border-b border-neutral-800/60 last:border-0 transition-opacity",
      stage.status === "idle" && "opacity-35",
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3">
        <StageIcon status={stage.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn(
              "text-[13px] font-medium leading-none",
              stage.status === "done"    && "text-neutral-200",
              stage.status === "running" && "text-white",
              stage.status === "failed"  && "text-red-400",
              stage.status === "idle"    && "text-neutral-500",
            )}>
              {stage.label}
            </span>
            {stage.sublabel && (
              <span className="text-[10px] text-neutral-700 font-mono truncate hidden sm:block">
                {stage.sublabel}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {stage.elapsed && (
            <span className="text-[10px] text-neutral-700 font-mono tabular-nums">
              {stage.elapsed}
            </span>
          )}
          {hasExpandable && (
            <button
              onClick={() => setOpen(o => !o)}
              className="text-neutral-700 hover:text-neutral-400 transition cursor-pointer"
            >
              <ChevronRight
                className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")}
              />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (upload + transcode) */}
      {stage.progress !== undefined && (
        <div className="pl-8">
          <ProgressBar value={stage.progress} status={stage.status} />
          {stage.status === "running" && stage.progress > 0 && (
            <p className="text-[10px] text-neutral-700 font-mono tabular-nums mt-0.5">
              {stage.progress}%
            </p>
          )}
        </div>
      )}

      {/* Inline detail (queue ARN, extract inputKey) */}
      {hasInlineDetail && stage.status === "done" && (
        <div className="pl-8 mt-1">{stage.detail}</div>
      )}

      {/* Expandable detail (transcode attempt / error) */}
      {hasExpandable && open && (
        <div className="pl-8 mt-2">{stage.detail}</div>
      )}
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

export const VideoUploadDialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen]                          = useState(false);
  const { state, upload, reset, proceedToEdit }  = useVideoUpload();
  const filenameRef                              = useRef("");
  const router                                   = useRouter();
  const [successAnim, setSuccessAnim]            = useState(false);

  const isIdle         = state.status === "idle";
  const isDone         = state.status === "done";
  const isActive       = !isIdle && !isDone;
  const isShowingStages = !isIdle;

  useEffect(() => {
    if (isDone) {
      const t = setTimeout(() => setSuccessAnim(true), 150);
      return () => clearTimeout(t);
    } else {
      setSuccessAnim(false);
    }
  }, [isDone]);

  const isTranscodeFailed =
    state.status === "transcoding" && state.pipeline.processingStatus === "FAILED";
  const isError = state.status === "error" || isTranscodeFailed;

  const totalElapsed = useDeployElapsed(isActive);

  const shortCode =
    state.status === "transcoding" ? state.shortCode :
    state.status === "done"        ? (state.video.shortCode ?? "") : "";

  const filename =
    state.status === "transcoding" || state.status === "done"
      ? state.filename
      : filenameRef.current;

  const stages = deriveStages(state);

  function goToContents() {
    handleDoneClose();
    router.push("/studio/contents");
  }

  function copyShortCode() {
    if (!shortCode) return;
    navigator.clipboard.writeText(shortCode);
    toast.success("已复制 shortCode");
  }

  // ── Open/close ───────────────────────────────────────────────────────────────
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (state.status === "uploading" || state.status === "finalizing") {
          toast.warning("上传中，无法关闭", {
            description: "文件正在上传，请等待完成后再关闭",
            duration: 4000,
          });
          return;
        }
        if (state.status === "transcoding") toast.info("转码将在后台继续进行");
        filenameRef.current = "";
        reset();
      }
      setOpen(nextOpen);
    },
    [state.status, reset],
  );

  const handleDoneClose = useCallback(() => {
    filenameRef.current = "";
    reset();
    setOpen(false);
  }, [reset]);

  // ── Dropzone ──────────────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        toast.error("格式不支持", { description: "只能上传 MP4 格式视频" });
        return;
      }
      const file = acceptedFiles[0];
      if (!file) return;
      if (state.status === "uploading" || state.status === "finalizing") return;
      filenameRef.current = file.name;
      upload(file);
    },
    [state.status, upload],
  );

  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: { "video/mp4": [] },
    multiple: false,
    noClick: true,
  });

  const dialogTitle =
    isDone ? "任务完成" : isActive ? "执行中…" : "上传视频";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        className="flex flex-col p-0 gap-0 rounded-2xl border border-neutral-800 bg-[#0a0a0a] overflow-hidden h-[88svh] max-h-[680px] w-full max-w-lg shadow-2xl"
        showCloseButton={false}
      >
        {/* ── Top bar ── */}
        <DialogHeader className="relative shrink-0 flex-row items-center h-12 border-b border-neutral-800 px-5">
          <DialogTitle className="text-sm font-medium text-neutral-300 leading-none">
            {dialogTitle}
          </DialogTitle>
          <DialogClose asChild>
            <button
              className="absolute top-2 right-3 size-8 rounded-lg flex items-center justify-center text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition cursor-pointer"
              aria-label="关闭"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* ── 任务信息栏（文件名 + shortCode + 耗时）── */}
        {isShowingStages && (
          <div className="shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-neutral-800 bg-neutral-900/40">
            <div className="flex items-center gap-2.5 min-w-0">
              <DeployBadge state={state} />
              {filename && (
                <span className="text-[11px] text-neutral-600 font-mono truncate">
                  {filename}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {shortCode && (
                <span className="text-[10px] text-neutral-700 font-mono select-all">
                  {shortCode}
                </span>
              )}
              {totalElapsed && (
                <span className="text-[10px] text-neutral-700 font-mono tabular-nums">
                  {totalElapsed}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Idle: drop zone ── */}
        {isIdle && (
          <div
            className="flex-1 flex flex-col justify-center items-center gap-5 px-6"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <div
              role="button"
              onClick={openFilePicker}
              className={cn(
                "relative size-28 rounded-full flex items-center justify-center cursor-pointer transition",
                "border border-neutral-800 bg-neutral-900/80 hover:border-neutral-600 hover:bg-neutral-800",
                isDragActive && "border-blue-500/60 bg-blue-500/5",
              )}
            >
              <Upload className="size-10 text-neutral-600" strokeWidth={1.5} />
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-sm font-medium text-neutral-200">将视频拖放至此处</p>
              <p className="text-xs text-neutral-600">MP4 格式 · 发布前处于私享状态</p>
            </div>
            <Button
              onClick={openFilePicker}
              className="h-8 px-4 rounded-full text-xs font-medium bg-white text-black hover:bg-neutral-200"
            >
              选择文件
            </Button>
          </div>
        )}

        {/* ── Pipeline stages (active + done) ── */}
        {isShowingStages && (
          <div className="flex-1 overflow-y-auto">
            {stages.map(stage => (
              <StageRow key={stage.id} stage={stage} />
            ))}

            {/* Top-level error message */}
            {state.status === "error" && (
              <div className="px-5 py-3">
                <div className="rounded-lg bg-red-500/8 border border-red-500/15 px-3 py-2.5 text-xs text-red-400 font-mono leading-relaxed">
                  {state.message}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Success strip (done) ── */}
        {isDone && (
          <div
            className={cn(
              "shrink-0 border-t border-[#50e3c2]/20 bg-gradient-to-r from-[#50e3c2]/6 to-transparent px-5 py-4",
              "transition-all duration-500 ease-out",
              successAnim ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              {/* Icon + info */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative size-8 shrink-0">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full bg-[#50e3c2]/20",
                      successAnim ? "animate-ping" : "",
                    )}
                    style={{ animationDuration: "1.4s", animationIterationCount: 2 }}
                  />
                  <div className="relative size-8 rounded-full bg-[#50e3c2]/10 border border-[#50e3c2]/30 flex items-center justify-center">
                    <Check className="size-3.5 text-[#50e3c2]" strokeWidth={2.5} />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-[#50e3c2] leading-none mb-1">处理完成</p>
                  <button
                    onClick={copyShortCode}
                    className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 transition font-mono cursor-pointer"
                  >
                    <span className="truncate">{shortCode}</span>
                    <Copy className="size-2.5 shrink-0" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="ghost" size="sm"
                  onClick={handleDoneClose}
                  className="h-7 px-3 rounded-full text-xs text-neutral-500 hover:text-white gap-1.5 cursor-pointer"
                >
                  再上传
                </Button>
                <Button
                  size="sm"
                  onClick={goToContents}
                  className="h-7 px-3 rounded-full text-xs font-medium bg-white text-black hover:bg-neutral-200 gap-1.5 cursor-pointer"
                >
                  内容管理
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Footer actions ── */}
        {isActive && (
          <div className="shrink-0 border-t border-neutral-800 px-5 py-3 flex items-center justify-between">
            <p className={cn(
              "text-[11px] text-neutral-700 transition-opacity",
              state.status === "transcoding" &&
              !isTranscodeFailed &&
              state.pipeline.processingStatus !== "READY"
                ? "opacity-100 animate-pulse"
                : "opacity-0 pointer-events-none",
            )}>
              转码完成后自动更新
            </p>

            <div className="flex items-center gap-2">
              {isError && (
                <Button
                  variant="ghost" size="sm"
                  onClick={handleDoneClose}
                  className="h-7 px-3 rounded-full text-xs text-neutral-500 hover:text-white gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="size-3" />
                  重新上传
                </Button>
              )}
              {state.status === "transcoding" &&
               !isTranscodeFailed &&
               state.pipeline.processingStatus !== "READY" && (
                <Button
                  variant="ghost" size="sm"
                  onClick={proceedToEdit}
                  className="h-7 px-3 rounded-full text-xs text-neutral-500 hover:text-white gap-1.5 cursor-pointer"
                >
                  跳过等待
                  <ArrowRight className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Idle footer ── */}
        {isIdle && (
          <p className="shrink-0 text-center text-[11px] text-neutral-800 py-3 border-t border-neutral-800">
            提交即表示你同意服务条款和社区准则
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
