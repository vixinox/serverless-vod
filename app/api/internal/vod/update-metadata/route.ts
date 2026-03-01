/**
 * POST /api/internal/vod/update-metadata
 *
 * Lambda vod-extract-metadata 的回调接口。
 * 收到请求后将 TranscodeJob 状态更新为 RUNNING，Video 状态更新为 PROCESSING。
 *
 * 仅允许持有 INTERNAL_API_SECRET 的内部调用方访问。
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function checkAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  // 如果未配置密钥则拒绝一切请求，防止意外暴露
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string; videoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, videoId } = body;
  if (!jobId || !videoId) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, videoId" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        attempt: { increment: 1 },
        lastError: null,
      },
    }),
    prisma.video.update({
      where: { id: videoId },
      data: { processingStatus: "PROCESSING", processingError: null },
    }),
  ]);

  console.log(`[api/update-metadata] job=${jobId} video=${videoId} → RUNNING/PROCESSING`);
  return NextResponse.json({ success: true });
}
