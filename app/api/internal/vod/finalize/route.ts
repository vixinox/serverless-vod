/**
 * POST /api/internal/vod/finalize
 *
 * Lambda vod-finalize 的回调接口。
 * 写入 VideoAsset（HLS_MASTER），将 Video 置为 READY，TranscodeJob 置为 SUCCEEDED。
 * 若 transcode 步骤提供了缩略图信息，同时写入 VideoAsset(THUMBNAIL) 并更新 Video.thumbnail。
 *
 * 仅允许持有 INTERNAL_API_SECRET 的内部调用方访问。
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function checkAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * 根据环境变量构造缩略图可访问 URL。
 * - 配置了 VIDEO_IMAGE_CDN_DOMAIN：https://<domain>/<key>
 * - 本地开发（未配置）：<LOCALSTACK_ENDPOINT>/<imageBucket>/<key>
 */
function buildThumbnailUrl(bucket: string, key: string): string {
  const cdnDomain = process.env.VIDEO_IMAGE_CDN_DOMAIN;
  if (cdnDomain) return `https://${cdnDomain}/${key}`;
  const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
  return `${endpoint}/${bucket}/${key}`;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    jobId?: string;
    videoId?: string;
    outputBucket?: string;
    outputPrefix?: string;
    /** transcode 步骤提取的视频元数据（可选） */
    durationSeconds?: number | null;
    width?: number | null;
    height?: number | null;
    /** transcode 步骤提取的缩略图（可选，截图失败时为 null） */
    thumbnailBucket?: string | null;
    thumbnailKey?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    jobId, videoId, outputBucket, outputPrefix,
    durationSeconds, width, height,
    thumbnailBucket, thumbnailKey,
  } = body;

  if (!jobId || !videoId || !outputBucket || !outputPrefix) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, videoId, outputBucket, outputPrefix" },
      { status: 400 },
    );
  }

  const manifestKey  = `${outputPrefix}/master.m3u8`;
  const thumbnailUrl = (thumbnailBucket && thumbnailKey)
    ? buildThumbnailUrl(thumbnailBucket, thumbnailKey)
    : null;

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: jobId },
      data:  { status: "SUCCEEDED", finishedAt: new Date(), pipelineStage: null },
    }),
    prisma.video.update({
      where: { id: videoId },
      data:  {
        processingStatus: "READY",
        processingError:  null,
        readyAt:          new Date(),
        ...(durationSeconds != null && { duration: durationSeconds }),
        ...(thumbnailUrl    != null && { thumbnail: thumbnailUrl }),
      },
    }),
    // 幂等删除旧 HLS_MASTER 资产，防止重试时重复写入
    prisma.videoAsset.deleteMany({ where: { videoId, assetType: "HLS_MASTER" } }),
    prisma.videoAsset.create({
      data: {
        videoId,
        assetType:     "HLS_MASTER",
        storageBucket: outputBucket,
        storageKey:    manifestKey,
        mimeType:      "application/vnd.apple.mpegurl",
        isPrimary:     true,
        width:    width    ?? null,
        height:   height   ?? null,
        duration: durationSeconds ?? null,
      },
    }),
    // 幂等删除旧 THUMBNAIL 资产
    ...(thumbnailBucket && thumbnailKey
      ? [
          prisma.videoAsset.deleteMany({ where: { videoId, assetType: "THUMBNAIL" } }),
          prisma.videoAsset.create({
            data: {
              videoId,
              assetType:     "THUMBNAIL",
              storageBucket: thumbnailBucket,
              storageKey:    thumbnailKey,
              mimeType:      "image/jpeg",
              isPrimary:     true,
            },
          }),
        ]
      : []),
  ]);

  console.log(
    `[api/finalize] job=${jobId} video=${videoId} → SUCCEEDED/READY` +
    ` duration=${durationSeconds ?? "unknown"}s ${width ?? "?"}x${height ?? "?"}` +
    ` thumbnail=${thumbnailUrl ?? "none"}`,
  );
  return NextResponse.json({ success: true });
}
