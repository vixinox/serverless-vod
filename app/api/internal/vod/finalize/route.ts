/**
 * POST /api/internal/vod/finalize
 *
 * finalize 是状态机成功路径的最后一步，负责登记转码结果。
 *
 * 主要写入三类数据：
 * 1. TranscodeJob 置为 SUCCEEDED，清空 pipelineStage。
 * 2. Video 置为 READY，并写入时长、封面等展示字段。
 * 3. 写入 VideoAsset，把 HLS master 清单和缩略图保存成可查询的资源记录。
 *
 * transcode Lambda 只返回处理结果；数据库写入集中在 finalize。
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
 * 线上返回图片 CDN 地址，本地开发返回 LocalStack 对象地址。
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
    // 重试成功后替换旧主清单记录。
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
    // 缩略图记录保持单主资源。
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
