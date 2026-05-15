/**
 * POST /api/internal/vod/stage
 *
 * transcode Lambda 在关键里程碑处回调该接口，将当前阶段写入 TranscodeJob.pipelineStage。
 * 前端轮询任务状态时读取该字段，展示下载、转码、上传等过程。
 *
 * 采用阶段而不是逐帧百分比，避免持续解析 ffmpeg 输出。
 *
 * 合法 stage 值（与 Lambda 代码保持一致）：
 *   job_started | downloading | probing | transcoding
 *   uploading_segments | thumbnail_extracting | thumbnail_uploading
 *
 * 仅允许持有 INTERNAL_API_SECRET 的内部调用方访问。
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/** 阶段白名单：只允许写入前端能识别的处理阶段。 */
const VALID_STAGES = new Set([
  "job_started",
  "downloading",
  "probing",
  "transcoding",
  "uploading_segments",
  "thumbnail_extracting",
  "thumbnail_uploading",
]);

function checkAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string; stage?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { jobId, stage } = body;
  if (!jobId || !stage) {
    return NextResponse.json(
      { error: "Missing required fields: jobId, stage" },
      { status: 400 },
    );
  }
  if (!VALID_STAGES.has(stage)) {
    return NextResponse.json(
      { error: `Unknown stage: ${stage}`, validStages: [...VALID_STAGES] },
      { status: 400 },
    );
  }

  await prisma.transcodeJob.updateMany({
    where: {
      id:     jobId,
      status: "RUNNING", // 只更新运行中的任务，防止迟到回调覆盖终态。
    },
    data: { pipelineStage: stage },
  });

  console.log(`[api/stage] job=${jobId} stage=${stage}`);
  return NextResponse.json({ success: true, stage });
}
