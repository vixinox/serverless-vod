/**
 * Lambda：`vod-extract-metadata`（轻客户端）
 *
 * 状态机第一步：
 * 通过调用 Next.js 内部 API 将 TranscodeJob 标记为 RUNNING，Video 标记为 PROCESSING，
 * 同时发布 pipeline.stage 事件（stage: "job_started"）。
 *
 * 输入 (Step Functions 注入):
 *   { jobId, videoId, shortCode, inputBucket, inputKey,
 *     outputBucket, outputPrefix, videoType }
 *
 * 环境变量：
 *   NEXT_API_BASE_URL     — Next.js 服务地址（本地: http://host.docker.internal:3000）
 *   INTERNAL_API_SECRET   — 内部调用共享密钥
 */
// _shared/ 与 index.mjs 同级打包在 /var/task/ 下，使用相对路径 ./ 而非 ../
import { callInternalApi } from "./_shared/api.mjs";
import { emitEvent } from "./_shared/events.mjs";

export const handler = async (event) => {
  const { jobId, videoId, shortCode, inputBucket, inputKey, outputBucket, outputPrefix, videoType } = event;

  if (!jobId || !videoId) {
    throw new Error(`extract-metadata: 缺少必要字段 jobId/videoId，收到: ${JSON.stringify(event)}`);
  }

  // 将任务/视频状态更新为 RUNNING/PROCESSING，并发布阶段事件
  await Promise.all([
    callInternalApi("/api/internal/vod/update-metadata", { jobId, videoId }),
    emitEvent("pipeline.stage", { jobId, videoId, shortCode, stage: "job_started" }),
  ]);

  console.log(`[extract-metadata] job=${jobId} shortCode=${shortCode} → RUNNING / stage=job_started`);

  // 透传完整上下文给 Transcode 步骤
  return { jobId, videoId, shortCode, inputBucket, inputKey, outputBucket, outputPrefix, videoType };
};
