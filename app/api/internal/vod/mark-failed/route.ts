/**
 * POST /api/internal/vod/mark-failed
 *
 * mark-failed 是状态机的失败处理入口。
 * ExtractMetadata、Transcode 或 Finalize 任一步抛错，Catch 会传入原始输入和错误信息。
 *
 * 该接口会同时把 TranscodeJob 和 Video 标记为 FAILED，并保存错误原因。
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

  // Step Functions 的 Cause 可能很长，入库前限制长度。
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
