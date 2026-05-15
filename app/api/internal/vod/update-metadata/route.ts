/**
 * POST /api/internal/vod/update-metadata
 *
 * extract-metadata 是状态机第一步，负责登记后台处理开始。
 *
 * 收到回调后更新两类状态：
 * - TranscodeJob 置为 RUNNING，记录 startedAt，并增加 attempt。
 * - Video 置为 PROCESSING，清空上一次失败留下的错误信息。
 *
 * 前端据此显示处理中状态。
 *
 * 仅允许持有 INTERNAL_API_SECRET 的内部调用方访问。
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

function checkAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  // 未配置密钥时直接拒绝，避免内部接口在本地或测试环境被误暴露。
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
