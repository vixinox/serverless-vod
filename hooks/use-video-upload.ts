import { useCallback, useRef, useState } from "react";
import type { Video } from "@prisma/client";
import { apiRequest } from "@/lib/api-client";
import type { PipelineStatus } from "@/lib/server/videos";

export type { PipelineStatus };

// ---------------------------------------------------------------------------
// 状态机类型
// ---------------------------------------------------------------------------

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number }
  | { status: "finalizing" }
  | {
      status: "transcoding";
      /** 用于轮询 & 透传给编辑表单 */
      video: Video;
      filename: string;
      shortCode: string;
      pipeline: PipelineStatus;
    }
  | { status: "done"; video: Video; filename: string }
  | { status: "error"; message: string };

const POLL_INTERVAL_MS = 3000;

// ---------------------------------------------------------------------------
// S3 XHR 上传辅助（返回 promise，支持进度回调）
// ---------------------------------------------------------------------------

function uploadFileToS3(
  url: string,
  file: File,
  onProgress: (percent: number) => void,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      xhrRef.current = null;
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`文件上传失败（HTTP ${xhr.status}）`));
      }
    };

    xhr.onerror = () => {
      xhrRef.current = null;
      reject(new Error("网络错误，上传过程中断"));
    };

    xhr.onabort = () => {
      xhrRef.current = null;
      // 标记取消，不当作错误
      reject(new Error("__aborted__"));
    };

    xhr.send(file);
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useVideoUpload() {
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const xhrRef      = useRef<XMLHttpRequest | null>(null);
  const abortedRef  = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 保留最新 state 供 interval 回调读取，避免闭包陷阱
  const stateRef    = useRef<UploadState>({ status: "idle" });

  function setStateSync(next: UploadState) {
    stateRef.current = next;
    setState(next);
  }

  function clearPolling() {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  /**
   * 中止正在进行的上传 / 轮询，将状态重置为 idle。
   */
  const reset = useCallback(() => {
    abortedRef.current = true;
    clearPolling();
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setStateSync({ status: "idle" });
  }, []);

  /**
   * 在 transcoding 阶段由用户手动跳过到编辑步骤（不等待转码完成）。
   */
  const proceedToEdit = useCallback(() => {
    const s = stateRef.current;
    if (s.status !== "transcoding") return;
    clearPolling();
    setStateSync({ status: "done", video: s.video, filename: s.filename });
  }, []);

  /**
   * 执行完整的上传流程：
   * 1. 从服务端获取预签名 URL & 创建草稿
   * 2. 客户端直传文件至 S3（支持进度回调）
   * 3. 通知服务端完成上传，触发 Step Functions
   * 4. 轮询 pipeline 状态直到 READY / FAILED
   */
  const upload = useCallback(async (file: File) => {
    abortedRef.current = false;
    clearPolling();

    if (file.type !== "video/mp4") {
      setStateSync({ status: "error", message: "只支持 MP4 格式视频" });
      return;
    }

    setStateSync({ status: "uploading", progress: 0 });

    // ── 1. 获取预签名 URL ─────────────────────────────────────────────
    let shortCode: string;
    let presignedUrl: string;

    try {
      const result = await apiRequest<{
        shortCode: string;
        url: string;
      }>("/api/uploads/video-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      });
      shortCode = result.shortCode;
      presignedUrl = result.url;
    } catch (err) {
      if (abortedRef.current) return;
      setStateSync({
        status: "error",
        message: err instanceof Error ? err.message : "获取上传地址失败",
      });
      return;
    }

    if (abortedRef.current) return;

    // ── 2. 直传文件至 S3 ──────────────────────────────────────────────
    try {
      await uploadFileToS3(
        presignedUrl,
        file,
        (progress) => {
          if (!abortedRef.current) {
            setStateSync({ status: "uploading", progress });
          }
        },
        xhrRef,
      );
    } catch (err) {
      if (abortedRef.current) return;
      setStateSync({
        status: "error",
        message: err instanceof Error ? err.message : "文件上传失败",
      });
      return;
    }

    if (abortedRef.current) return;

    // ── 3. 通知服务端完成上传，触发 Step Functions ──────────────────
    setStateSync({ status: "finalizing" });

    let video: Video;
    try {
      video = await apiRequest<Video>("/api/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          shortCode,
        }),
      });
      if (abortedRef.current) return;
    } catch (err) {
      if (abortedRef.current) return;
      setStateSync({
        status: "error",
        message: err instanceof Error ? err.message : "提交转码任务失败",
      });
      return;
    }

    // ── 4. 进入 transcoding 状态并开始轮询 ───────────────────────────
    let initialPipeline: PipelineStatus;
    try {
      initialPipeline = await apiRequest<PipelineStatus>(`/api/videos/${shortCode}/pipeline-status`);
    } catch {
      initialPipeline = {
        processingStatus: "PROCESSING",
        jobId: null, jobStatus: "QUEUED", jobError: null,
        attempt: 0, maxAttempts: 3, pipelineStage: null, executionArn: null,
        inputKey: `${shortCode}/source.mp4`,
        queuedAt: new Date().toISOString(), startedAt: null, finishedAt: null,
      };
    }

    if (abortedRef.current) return;
    setStateSync({ status: "transcoding", video, filename: file.name, shortCode, pipeline: initialPipeline });

    intervalRef.current = setInterval(async () => {
      if (abortedRef.current) { clearPolling(); return; }

      let pipeline: PipelineStatus;
      try {
        pipeline = await apiRequest<PipelineStatus>(`/api/videos/${shortCode}/pipeline-status`);
      } catch {
        return; // 网络抖动跳过本次，下次再试
      }

      if (abortedRef.current) { clearPolling(); return; }

      if (pipeline.processingStatus === "READY") {
        clearPolling();
        // 保留 video 对象（用于编辑表单），状态切换到 done
        setStateSync({ status: "done", video, filename: file.name });
      } else if (pipeline.processingStatus === "FAILED") {
        clearPolling();
        setStateSync({
          status: "error",
          message: pipeline.jobError ?? "视频转码失败",
        });
      } else {
        // 更新 pipeline 细节，状态保持 transcoding
        setStateSync({
          status: "transcoding",
          video,
          filename: file.name,
          shortCode,
          pipeline,
        });
      }
    }, POLL_INTERVAL_MS);
  }, []);

  return { state, upload, reset, proceedToEdit };
}
