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
import { X, Check, Loader2, Upload, Copy, ArrowRight, RotateCcw } from "lucide-react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { useVideoUpload, type UploadState } from "@/hooks/use-video-upload";
import type { PipelineStatus } from "@/actions/video/get-pipeline-status";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

const CLOSE_WARN_DURATION = 4000;

//  Log system 

let _logId = 0;

type LogLevel = "cmd" | "info" | "ok" | "err" | "dim";

interface LogEntry {
  id: number;
  time: string;
  text: string;
  level: LogLevel;
}

function makeLog(text: string, level: LogLevel = "info"): LogEntry {
  const d = new Date();
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return { id: _logId++, time: t, text, level };
}

//  Step indicator 

type StepSt = "pending" | "active" | "done" | "failed";

const PIPELINE_STEPS = ["S3 上传", "触发管道", "转码处理", "完成"] as const;

function getStepStates(state: UploadState): StepSt[] {
  const s: StepSt[] = ["pending", "pending", "pending", "pending"];
  switch (state.status) {
    case "uploading":
      s[0] = "active";
      break;
    case "finalizing":
      s[0] = "done";
      s[1] = "active";
      break;
    case "transcoding": {
      s[0] = "done";
      s[1] = "done";
      const { processingStatus, jobStatus } = state.pipeline;
      if (processingStatus === "READY") {
        s[2] = "done";
        s[3] = "done";
      } else if (processingStatus === "FAILED" || jobStatus === "FAILED") {
        s[2] = "failed";
      } else {
        s[2] = "active";
      }
      break;
    }
    case "done":
      s[0] = "done";
      s[1] = "done";
      s[2] = "done";
      s[3] = "done";
      break;
  }
  return s;
}

function StepDot({ st }: { st: StepSt }) {
  return (
    <div
      className={cn(
        "size-5 rounded-full flex items-center justify-center shrink-0",
        st === "done"    && "bg-green-500/20 text-green-500",
        st === "active"  && "bg-blue-500/20 text-blue-400",
        st === "failed"  && "bg-destructive/20 text-destructive",
        st === "pending" && "bg-muted/60 text-muted-foreground/40",
      )}
    >
      {st === "done"    && <Check   className="size-3" strokeWidth={3} />}
      {st === "active"  && <Loader2 className="size-3 animate-spin" />}
      {st === "failed"  && <X       className="size-3" />}
      {st === "pending" && <span className="size-1.5 rounded-full bg-current" />}
    </div>
  );
}

function StepBar({ state }: { state: UploadState }) {
  const steps = getStepStates(state);
  return (
    <div className="flex items-center px-6 py-3 border-b">
      {PIPELINE_STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <StepDot st={steps[i]} />
            <span
              className={cn(
                "text-[10px] leading-none whitespace-nowrap",
                steps[i] === "done"    && "text-green-500",
                steps[i] === "active"  && "text-foreground",
                steps[i] === "failed"  && "text-destructive",
                steps[i] === "pending" && "text-muted-foreground/50",
              )}
            >
              {label}
            </span>
          </div>
          {i < PIPELINE_STEPS.length - 1 && (
            <div
              className={cn(
                "flex-1 h-px mx-2 mb-4",
                steps[i] === "done" ? "bg-green-500/40" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

//  Log terminal 

const LEVEL_STYLES: Record<LogLevel, string> = {
  cmd:  "text-foreground font-semibold",
  info: "text-foreground/80",
  ok:   "text-green-400",
  err:  "text-red-400",
  dim:  "text-muted-foreground",
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  cmd:  "",
  info: " ",
  ok:   "",
  err:  "",
  dim:  " ",
};

function LogTerminal({ logs, className }: { logs: LogEntry[]; className?: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto font-mono text-xs leading-6 px-4 py-3",
        "bg-black/60 rounded-xl border border-border/40",
        className,
      )}
    >
      {logs.map((entry) => (
        <div key={entry.id} className="flex gap-2 min-w-0">
          <span className="shrink-0 text-muted-foreground/50 select-none tabular-nums">
            {entry.time}
          </span>
          <span className={cn("shrink-0 select-none w-3", LEVEL_STYLES[entry.level])}>
            {LEVEL_PREFIX[entry.level]}
          </span>
          <span className={cn("break-all", LEVEL_STYLES[entry.level])}>
            {entry.text}
          </span>
        </div>
      ))}
      {logs.length === 0 && (
        <span className="text-muted-foreground/40">等待任务开始</span>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

//  Done view 

function DoneView({
  shortCode,
  filename,
  onClose,
}: {
  shortCode: string;
  filename: string;
  onClose: () => void;
}) {
  const router = useRouter();

  function goToContents() {
    onClose();
    router.push("/studio/contents");
  }

  function copyCode() {
    navigator.clipboard.writeText(shortCode);
    toast.success("已复制 shortCode");
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-10">
      <div className="size-14 rounded-full bg-green-500/15 flex items-center justify-center">
        <Check className="size-7 text-green-500" strokeWidth={2.5} />
      </div>

      <div className="text-center space-y-1.5">
        <p className="text-base font-semibold">视频已就绪</p>
        <p className="text-sm text-muted-foreground font-mono">{filename}</p>
        <button
          onClick={copyCode}
          className="flex items-center gap-1 mx-auto text-xs text-muted-foreground hover:text-foreground transition font-mono"
        >
          {shortCode}
          <Copy className="size-3" />
        </button>
      </div>

      <Button className="rounded-full gap-2" onClick={goToContents}>
        前往内容管理
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

//  Main dialog 

export const VideoUploadDialog = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);
  const { state, upload, reset, proceedToEdit } = useVideoUpload();

  //  Log accumulation 
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef           = useRef<LogEntry[]>([]);
  const prevStateRef      = useRef<UploadState>({ status: "idle" });
  const prevPipelineRef   = useRef<PipelineStatus | null>(null);
  const lastProgressBucket = useRef(-1);

  function pushLogs(...entries: LogEntry[]) {
    logsRef.current = [...logsRef.current, ...entries];
    setLogs([...logsRef.current]);
  }

  function clearLogs() {
    logsRef.current = [];
    setLogs([]);
    prevStateRef.current = { status: "idle" };
    prevPipelineRef.current = null;
    lastProgressBucket.current = -1;
  }

  useEffect(() => {
    const prev = prevStateRef.current;
    const curr = state;
    prevStateRef.current = curr;

    // idle  uploading
    if (prev.status === "idle" && curr.status === "uploading") {
      lastProgressBucket.current = -1;
      pushLogs(
        makeLog("S3 Upload", "cmd"),
        makeLog("初始化上传", "dim"),
      );
      return;
    }

    // uploading 进度
    if (curr.status === "uploading") {
      const bucket = Math.floor(curr.progress / 25) * 25;
      if (bucket > lastProgressBucket.current && curr.progress > 0) {
        lastProgressBucket.current = bucket;
        if (curr.progress < 100) {
          pushLogs(makeLog(`${curr.progress}%`, "dim"));
        }
      }
      return;
    }

    // uploading  finalizing
    if (prev.status === "uploading" && curr.status === "finalizing") {
      pushLogs(
        makeLog("上传完成", "ok"),
        makeLog("Trigger Pipeline", "cmd"),
        makeLog("创建转码任务", "dim"),
      );
      return;
    }

    // finalizing  transcoding
    if (prev.status === "finalizing" && curr.status === "transcoding") {
      const { executionArn, jobId } = curr.pipeline;
      pushLogs(makeLog("Step Functions Execution 已启动", "ok"));
      if (executionArn) {
        const execName = executionArn.split(":").pop() ?? executionArn;
        pushLogs(makeLog(execName, "dim"));
      }
      if (jobId) pushLogs(makeLog(`job=${jobId}`, "dim"));
      pushLogs(makeLog("Transcode", "cmd"));
      prevPipelineRef.current = curr.pipeline;
      return;
    }

    // transcoding 轮询 delta
    if (curr.status === "transcoding") {
      const prev2 = prevPipelineRef.current;
      const p = curr.pipeline;

      if (!prev2) {
        prevPipelineRef.current = p;
        return;
      }

      const additions: LogEntry[] = [];

      if (p.jobStatus !== prev2.jobStatus && p.jobStatus) {
        if (p.jobStatus === "RUNNING") {
          additions.push(makeLog("Lambda vod-extract-metadata  RUNNING", "info"));
        } else if (p.jobStatus === "SUCCEEDED") {
          additions.push(makeLog("转码流程全部完成", "ok"));
        } else if (p.jobStatus === "FAILED") {
          additions.push(makeLog("转码任务失败", "err"));
        }
      }

      if (p.attempt !== prev2.attempt && p.attempt > 0) {
        additions.push(
          makeLog(
            `Lambda vod-transcode  attempt ${p.attempt} / ${p.maxAttempts}`,
            "info",
          ),
        );
      }

      if (p.startedAt && !prev2.startedAt) {
        const ts = new Date(p.startedAt).toLocaleTimeString();
        additions.push(makeLog(`vod-transcode 开始执行  started=${ts}`, "dim"));
      }

      if (p.jobError && p.jobError !== prev2.jobError) {
        additions.push(makeLog(p.jobError, "err"));
      }

      if (p.processingStatus !== prev2.processingStatus) {
        if (p.processingStatus === "READY") {
          additions.push(
            makeLog("Lambda vod-finalize  SUCCEEDED", "ok"),
            makeLog("processingStatus = READY ", "ok"),
          );
        } else if (p.processingStatus === "FAILED") {
          additions.push(makeLog("processingStatus = FAILED", "err"));
        }
      }

      if (additions.length > 0) pushLogs(...additions);
      prevPipelineRef.current = p;
      return;
    }

    // transcoding  done (pipeline READY 后 hook 自动切换)
    if (curr.status === "done" && prev.status === "transcoding") {
      pushLogs(makeLog("Done", "cmd"), makeLog("所有步骤执行完毕", "ok"));
      return;
    }

    // error
    if (curr.status === "error") {
      pushLogs(makeLog(curr.message, "err"));
    }
  }, [state]);

  //  Dialog open/close 
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        const isHardBlocked =
          state.status === "uploading" || state.status === "finalizing";
        if (isHardBlocked) {
          toast.warning("上传中，无法关闭", {
            description: "文件正在上传，请等待完成后再关闭",
            duration: CLOSE_WARN_DURATION,
          });
          return;
        }
        if (state.status === "transcoding") {
          toast.info("转码将在后台继续进行");
        }
        clearLogs();
        reset();
      }
      setOpen(nextOpen);
    },
    [state.status, reset],
  );

  const handleDoneClose = useCallback(() => {
    clearLogs();
    reset();
    setOpen(false);
  }, [reset]);

  //  Dropzone 
  const onDrop = useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (fileRejections.length > 0) {
        toast.error("格式不支持", { description: "只能上传 MP4 格式视频" });
        return;
      }
      const file = acceptedFiles[0];
      if (!file) return;
      const isActive =
        state.status === "uploading" || state.status === "finalizing";
      if (isActive) return;
      upload(file);
    },
    [state.status, upload],
  );

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openFilePicker,
  } = useDropzone({
    onDrop,
    accept: { "video/mp4": [] },
    multiple: false,
    noClick: true,
  });

  //  View flags 
  const isIdle     = state.status === "idle";
  const isDone     = state.status === "done";
  const isPipeline =
    state.status === "uploading"   ||
    state.status === "finalizing"  ||
    state.status === "transcoding" ||
    state.status === "error";

  const shortCode =
    state.status === "transcoding"
      ? state.shortCode
      : state.status === "done"
      ? (state.video.shortCode ?? "")
      : "";

  const filename =
    state.status === "transcoding" || state.status === "done"
      ? state.filename
      : "";

  const isTranscodeFailed =
    state.status === "transcoding" && state.pipeline.processingStatus === "FAILED";

  const dialogTitle = isDone ? "转码完成" : isPipeline ? "部署视频" : "上传视频";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent
        className="flex flex-col p-0 rounded-3xl border-none bg-studio-background overflow-hidden h-[90svh] max-h-200"
        showCloseButton={false}
      >
        {/* 顶栏 */}
        <DialogHeader className="relative shrink-0 h-14 border-b">
          <DialogTitle className="text-xl font-medium px-6 py-4 leading-none">
            {dialogTitle}
          </DialogTitle>
          <DialogClose asChild>
            <button
              className="absolute top-2 right-4 size-10 rounded-full p-2 bg-transparent hover:bg-foreground/10 cursor-pointer transition"
              aria-label="关闭"
            >
              <X className="size-full" strokeWidth={1} />
            </button>
          </DialogClose>
        </DialogHeader>

        {/* 步骤条 */}
        {isPipeline && <StepBar state={state} />}

        {/* Idle: 拖放区 */}
        {isIdle && (
          <div
            className="flex-1 flex flex-col justify-center items-center gap-6 px-6"
            {...getRootProps()}
          >
            <input {...getInputProps()} />
            <div
              role="button"
              onClick={openFilePicker}
              className={cn(
                "relative size-32 rounded-full flex items-center justify-center",
                "bg-studio-background brightness-80 border-2 transition cursor-pointer hover:opacity-80",
                isDragActive ? "border-blue-500" : "border-transparent",
              )}
            >
              <Upload className="size-1/2 brightness-75" />
            </div>
            <div className="text-center space-y-1">
              <p>将要上传的视频文件拖放到此处</p>
              <p className="text-sm text-muted-foreground">
                你的视频在发布之前将处于私享状态
              </p>
            </div>
            <Button className="rounded-full font-medium" onClick={openFilePicker}>
              上传视频
            </Button>
          </div>
        )}

        {/* Pipeline: 日志终端 */}
        {isPipeline && (
          <div className="flex-1 flex flex-col min-h-0 px-5 py-4 gap-3">
            {filename && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 font-mono">
                {shortCode && (
                  <>
                    <span className="select-all">{shortCode}</span>
                    <span className="opacity-40"></span>
                  </>
                )}
                <span className="truncate">{filename}</span>
              </div>
            )}

            <LogTerminal logs={logs} className="flex-1 min-h-0" />

            {/* 转码进行中：跳过按钮 */}
            {state.status === "transcoding" &&
              state.pipeline.processingStatus !== "READY" &&
              !isTranscodeFailed && (
                <div className="shrink-0 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground animate-pulse">
                    转码完成后将自动更新
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-xs text-muted-foreground gap-1"
                    onClick={proceedToEdit}
                  >
                    跳过等待
                    <ArrowRight className="size-3" />
                  </Button>
                </div>
              )}

            {/* 失败或 error：重新上传 */}
            {(state.status === "error" || isTranscodeFailed) && (
              <div className="shrink-0 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-xs gap-1"
                  onClick={handleDoneClose}
                >
                  <RotateCcw className="size-3" />
                  重新上传
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Done: 成功卡片 */}
        {isDone && (
          <DoneView
            shortCode={shortCode}
            filename={filename}
            onClose={handleDoneClose}
          />
        )}

        {/* 底部条款（仅 idle）*/}
        {isIdle && (
          <p className="shrink-0 text-center text-xs text-muted-foreground py-4 border-t">
            提交视频即表示你同意服务条款和社区准则
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
