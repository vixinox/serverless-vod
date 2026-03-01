/**
 * Lambda: vod-finalize  (Thin Client)
 *
 * 状态机第三步（成功路径）：
 * 通过调用 Next.js 内部 API 写入 VideoAsset 并将任务/视频标记为完成。
 * 无任何直接数据库依赖。
 *
 * 输入（来自 Transcode 步骤输出）：
 *   { jobId, videoId, shortCode, outputBucket, outputPrefix }
 *
 * 环境变量：
 *   NEXT_API_BASE_URL     — Next.js 服务地址（本地: http://host.docker.internal:3000）
 *   INTERNAL_API_SECRET   — 内部调用共享密钥
 */
// _shared/ 与 index.mjs 同级打包在 /var/task/ 下，使用相对路径 ./ 而非 ../
import { callInternalApi } from "./_shared/api.mjs";

export const handler = async (event) => {
  const { jobId, videoId, outputBucket, outputPrefix } = event;

  if (!jobId || !videoId) {
    throw new Error(`finalize: 缺少必要字段，收到: ${JSON.stringify(event)}`);
  }

  await callInternalApi("/api/internal/vod/finalize", {
    jobId,
    videoId,
    outputBucket,
    outputPrefix,
  });

  console.log(`[finalize] job=${jobId} → SUCCEEDED / video → READY`);
  return { success: true, jobId, videoId };
};
