'use client'

import { Check, Loader2, X, Clock, Copy } from "lucide-react";
import type { PipelineStatus } from "@/actions/video/get-pipeline-status";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface TranscodingStepProps {
  filename: string;
  shortCode: string;
  pipeline: PipelineStatus;
  onSkipToEdit: () => void;
}

// ── 经过时间格式化（mm:ss）──────────────────────────────────────────────────

function useElapsed(from: string | null): string {
  if (!from) return "";
  const secs = Math.floor((Date.now() - new Date(from).getTime()) / 1000);
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

// ── 步骤行 ────────────────────────────────────────────────────────────────

type StepState = "done" | "active" | "failed" | "pending";

function StepIcon({ step }: { step: StepState }) {
  return (
    <div
      className={cn(
        "mt-0.5 size-5 rounded-full flex items-center justify-center shrink-0 text-[10px]",
        step === "done"    && "bg-green-500/15 text-green-500",
        step === "active"  && "bg-blue-500/15 text-blue-400",
        step === "failed"  && "bg-destructive/15 text-destructive",
        step === "pending" && "bg-muted text-muted-foreground",
      )}
    >
      {step === "done"    && <Check  className="size-3" strokeWidth={3} />}
      {step === "active"  && <Loader2 className="size-3 animate-spin" />}
      {step === "failed"  && <X      className="size-3" />}
      {step === "pending" && <span className="size-1.5 rounded-full bg-current" />}
    </div>
  );
}

function StepRow({
  step,
  label,
  detail,
}: {
  step: StepState;
  label: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <StepIcon step={step} />
      <div className="flex flex-col gap-0.5 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-none",
            step === "done"    && "text-green-500",
            step === "active"  && "text-foreground",
            step === "failed"  && "text-destructive",
            step === "pending" && "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {detail && (
          <div className="text-xs text-muted-foreground leading-relaxed">{detail}</div>
        )}
      </div>
    </div>
  );
}

// ── 主组件 ────────────────────────────────────────────────────────────────

export function TranscodingStep({
  filename,
  shortCode,
  pipeline,
  onSkipToEdit,
}: TranscodingStepProps) {
  const {
    jobStatus,
    jobError,
    attempt,
    maxAttempts,
    executionArn,
    inputKey,
    queuedAt,
    startedAt,
  } = pipeline;

  const elapsed = useElapsed(queuedAt);

  // ── 各步骤状态推导 ───────────────────────────────────────────────────────

  const uploadStep: StepState  = "done"; // 到达此组件表示上传已完成

  const sfnStep: StepState = executionArn
    ? "done"
    : jobStatus === null
    ? "active"
    : "done";

  const transcodeStep: StepState =
    pipeline.processingStatus === "FAILED" || jobStatus === "FAILED"
      ? "failed"
      : jobStatus === "SUCCEEDED" || pipeline.processingStatus === "READY"
      ? "done"
      : jobStatus === "RUNNING"
      ? "active"
      : jobStatus === "QUEUED"
      ? "active"   // 排队中也显示 active（有进度感）
      : "pending";

  // ── ExecutionARN 展示（只截取末段 execution name）────────────────────────
  const arnDisplay = executionArn
    ? executionArn.split(":").slice(-1)[0]
    : null;

  function copyArn() {
    if (!executionArn) return;
    navigator.clipboard.writeText(executionArn);
    toast.success("已复制 Execution ARN");
  }

  const isTerminal =
    pipeline.processingStatus === "READY" ||
    pipeline.processingStatus === "FAILED";

  return (
    <div className="flex-1 flex flex-col justify-center items-center gap-5 px-6 py-8">
      {/* ── 标题 ── */}
      <div className="text-center space-y-1.5">
        <p className="font-semibold text-base">
          {pipeline.processingStatus === "FAILED" ? "转码失败" : "视频处理中…"}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{filename}</span>
          <span className="mx-1.5 opacity-40">·</span>
          <span className="font-mono select-all">{shortCode}</span>
        </p>
      </div>

      {/* ── Pipeline 步骤面板 ── */}
      <div className="w-full max-w-sm rounded-2xl border bg-muted/30 divide-y">

        {/* S3 上传 */}
        <div className="p-4">
          <StepRow
            step={uploadStep}
            label="S3 上传"
            detail={
              <span className="font-mono break-all">
                {inputKey ?? `${shortCode}/source.mp4`}
              </span>
            }
          />
        </div>

        {/* Step Functions 触发 */}
        <div className="p-4">
          <StepRow
            step={sfnStep}
            label="Step Functions 触发"
            detail={
              arnDisplay && (
                <button
                  onClick={copyArn}
                  className="flex items-center gap-1 font-mono break-all hover:text-foreground transition cursor-pointer text-left"
                >
                  <span className="truncate max-w-65">{arnDisplay}</span>
                  <Copy className="size-3 shrink-0" />
                </button>
              )
            }
          />
        </div>

        {/* 视频转码 */}
        <div className="p-4 space-y-2">
          <StepRow
            step={transcodeStep}
            label={`视频转码${jobStatus ? `（${jobStatus}）` : ""}`}
            detail={
              <div className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <span>尝试 {attempt} / {maxAttempts}</span>
                  {elapsed && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {elapsed}
                    </span>
                  )}
                  {startedAt && (
                    <span className="text-blue-400">运行中</span>
                  )}
                </div>
              </div>
            }
          />

          {/* 错误信息 */}
          {jobError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-2.5 text-xs text-destructive font-mono break-all leading-relaxed">
              {jobError}
            </div>
          )}
        </div>
      </div>

      {/* ── 操作区 ── */}
      {!isTerminal && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-muted-foreground animate-pulse">
            转码完成后将自动跳转
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs text-muted-foreground"
            onClick={onSkipToEdit}
          >
            不等了，先去填写视频信息
          </Button>
        </div>
      )}

      {pipeline.processingStatus === "FAILED" && (
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full"
          onClick={onSkipToEdit}
        >
          编辑视频信息
        </Button>
      )}
    </div>
  );
}
