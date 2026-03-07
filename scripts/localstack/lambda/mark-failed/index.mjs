/**
 * Lambda：`vod-mark-failed`（轻客户端）
 *
 * 状态机 Catch 路径：
 * 通过调用 Next.js 内部 API 将 TranscodeJob 和 Video 置为 FAILED。
 * 无任何直接数据库依赖。
 *
 * Step Functions Parameters 负责从 $$.Execution.Input 注入 jobId/videoId，
 * 并从 $.errorInfo.Error / $.errorInfo.Cause 注入错误信息（ResultPath: $.errorInfo）。
 *
 * 输入：
 *   { jobId, videoId, error, cause }
 *
 * 环境变量：
 *   NEXT_API_BASE_URL     — Next.js 服务地址（本地: http://host.docker.internal:3000）
 *   INTERNAL_API_SECRET   — 内部调用共享密钥
 */
// _shared/ 与 index.mjs 同级打包在 /var/task/ 下，使用相对路径 ./ 而非 ../
import { callInternalApi } from "./_shared/api.mjs";

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function toErrorText(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const handler = async (event) => {
  const jobId = firstNonEmpty(
    event?.jobId,
    event?.input?.jobId,
    event?.executionInput?.jobId,
  );
  const videoId = firstNonEmpty(
    event?.videoId,
    event?.input?.videoId,
    event?.executionInput?.videoId,
  );
  const error = toErrorText(
    firstNonEmpty(event?.error, event?.errorInfo?.Error),
    "States.TaskFailed",
  );
  const cause = toErrorText(
    firstNonEmpty(event?.cause, event?.errorInfo?.Cause),
    "No failure cause provided",
  );

  if (!jobId || !videoId) {
    // mark-failed 本身不应再触发 Catch，记录日志后优雅退出
    console.error(`[mark-failed] 缺少 jobId/videoId，无法更新状态。事件: ${JSON.stringify(event)}`);
    return { success: false };
  }

  await callInternalApi("/api/internal/vod/mark-failed", { jobId, videoId, error, cause });

  console.log(`[mark-failed] job=${jobId} → FAILED`);
  return { success: true, jobId, videoId };
};
