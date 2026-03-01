/**
 * Lambda: vod-extract-metadata  (Thin Client)
 *
 * 状态机第一步：
 * 通过调用 Next.js 内部 API 将 TranscodeJob 标记为 RUNNING，Video 标记为 PROCESSING。
 * 无任何直接数据库依赖，依赖完全从 package.json 移除。
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

export const handler = async (event) => {
  const { jobId, videoId, shortCode, inputBucket, inputKey, outputBucket, outputPrefix, videoType } = event;

  if (!jobId || !videoId) {
    throw new Error(`extract-metadata: 缺少必要字段 jobId/videoId，收到: ${JSON.stringify(event)}`);
  }

  await callInternalApi("/api/internal/vod/update-metadata", { jobId, videoId });

  console.log(`[extract-metadata] job=${jobId} shortCode=${shortCode} → RUNNING`);

  // 透传完整上下文给 Transcode 步骤
  return { jobId, videoId, shortCode, inputBucket, inputKey, outputBucket, outputPrefix, videoType };
};
