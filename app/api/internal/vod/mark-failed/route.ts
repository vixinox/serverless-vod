/**
 * POST /api/internal/vod/mark-failed
 *
 * Lambda vod-mark-failed 的回调接口。
 * 将 TranscodeJob 和 Video 状态均置为 FAILED，并记录错误原因。
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

  let body: { jobId?: string; videoId?: string; error?: string; cause?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, videoId, error, cause } = body;
  if (!jobId || !videoId) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, videoId" },
      { status: 400 },
    );
  }

  // 拼接错误信息，限长 1000 字符，避免写入过长的 Cause 字符串
  const message =
    [error, cause].filter(Boolean).join(": ").slice(0, 1000) || "transcode failed";

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: jobId },
      data: { status: "FAILED", lastError: message, finishedAt: new Date() },
    }),
    prisma.video.update({
      where: { id: videoId },
      data: { processingStatus: "FAILED", processingError: message },
    }),
  ]);

  console.log(`[api/mark-failed] job=${jobId} video=${videoId} → FAILED reason=${message}`);
  return NextResponse.json({ success: true });
}
