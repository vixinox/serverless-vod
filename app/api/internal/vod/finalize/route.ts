/**
 * POST /api/internal/vod/finalize
 *
 * Lambda vod-finalize 的回调接口。
 * 写入 VideoAsset（HLS_MASTER），将 Video 置为 READY，TranscodeJob 置为 SUCCEEDED。
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

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    jobId?: string;
    videoId?: string;
    outputBucket?: string;
    outputPrefix?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, videoId, outputBucket, outputPrefix } = body;
  if (!jobId || !videoId || !outputBucket || !outputPrefix) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, videoId, outputBucket, outputPrefix" },
      { status: 400 },
    );
  }

  const manifestKey = `${outputPrefix}/master.m3u8`;

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: jobId },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    }),
    prisma.video.update({
      where: { id: videoId },
      data: { processingStatus: "READY", processingError: null, readyAt: new Date() },
    }),
    // 幂等删除旧 HLS_MASTER 资产，防止重试时重复写入
    prisma.videoAsset.deleteMany({
      where: { videoId, assetType: "HLS_MASTER" },
    }),
    prisma.videoAsset.create({
      data: {
        videoId,
        assetType: "HLS_MASTER",
        storageBucket: outputBucket,
        storageKey: manifestKey,
        mimeType: "application/vnd.apple.mpegurl",
        isPrimary: true,
      },
    }),
  ]);

  console.log(`[api/finalize] job=${jobId} video=${videoId} → SUCCEEDED/READY`);
  return NextResponse.json({ success: true });
}
