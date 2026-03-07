/**
 * POST /api/internal/vod/reconcile-stale
 *
 * Internal maintenance endpoint:
 * - Find stale transcode jobs (QUEUED/RUNNING older than threshold)
 * - Mark stale jobs as FAILED
 * - Mark corresponding videos as FAILED when they are still PROCESSING and
 *   have no other active transcode job
 *
 * Auth:
 * - Requires Authorization: Bearer <INTERNAL_API_SECRET>
 */
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type JobStatus = "QUEUED" | "RUNNING";

type RequestBody = {
  staleMinutes?: number;
  limit?: number;
  dryRun?: boolean;
};

function checkAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function resolvePositiveInt(value: unknown, fallback: number, max: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    const intValue = Math.trunc(value);
    if (intValue >= 1) return Math.min(intValue, max);
  }
  if (typeof value === "string") {
    const intValue = Number.parseInt(value, 10);
    if (Number.isFinite(intValue) && intValue >= 1) return Math.min(intValue, max);
  }
  return fallback;
}

function isStaleJob(job: {
  status: JobStatus;
  queuedAt: Date;
  startedAt: Date | null;
}, cutoff: Date): boolean {
  if (job.status === "RUNNING") {
    if (job.startedAt) return job.startedAt < cutoff;
    return job.queuedAt < cutoff;
  }
  return job.queuedAt < cutoff;
}

export async function POST(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RequestBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const staleMinutes = resolvePositiveInt(
    body.staleMinutes,
    resolvePositiveInt(process.env.VOD_STALE_PROCESSING_MINUTES, 45, 24 * 60),
    24 * 60,
  );
  const limit = resolvePositiveInt(body.limit, 200, 1000);
  const dryRun = body.dryRun === true;

  const now = new Date();
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000);
  const staleReason = `stale transcode job reconciled after ${staleMinutes} minutes`;

  const candidates = await prisma.transcodeJob.findMany({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
      queuedAt: { lt: cutoff },
    },
    orderBy: { queuedAt: "asc" },
    take: limit,
    select: {
      id: true,
      videoId: true,
      status: true,
      queuedAt: true,
      startedAt: true,
      pipelineStage: true,
      video: {
        select: {
          shortCode: true,
          processingStatus: true,
        },
      },
    },
  });

  const staleJobs = candidates.filter((job) =>
    isStaleJob(
      {
        status: job.status as JobStatus,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
      },
      cutoff,
    ));

  if (staleJobs.length === 0) {
    return NextResponse.json({
      success: true,
      dryRun,
      staleMinutes,
      cutoff: cutoff.toISOString(),
      reconciledJobs: 0,
      reconciledVideos: 0,
      sample: [],
    });
  }

  const staleJobIds = staleJobs.map((job) => job.id);
  const staleVideoIds = [...new Set(staleJobs.map((job) => job.videoId))];

  const otherActiveJobs = await prisma.transcodeJob.findMany({
    where: {
      videoId: { in: staleVideoIds },
      status: { in: ["QUEUED", "RUNNING"] },
      id: { notIn: staleJobIds },
    },
    select: { videoId: true },
  });
  const protectedVideoIds = new Set(otherActiveJobs.map((job) => job.videoId));
  const targetVideoIds = staleVideoIds.filter((videoId) => !protectedVideoIds.has(videoId));

  if (dryRun) {
    return NextResponse.json({
      success: true,
      dryRun: true,
      staleMinutes,
      cutoff: cutoff.toISOString(),
      reconciledJobs: staleJobs.length,
      reconciledVideos: targetVideoIds.length,
      sample: staleJobs.slice(0, 20).map((job) => ({
        jobId: job.id,
        videoId: job.videoId,
        shortCode: job.video.shortCode,
        jobStatus: job.status,
        videoStatus: job.video.processingStatus,
        queuedAt: job.queuedAt.toISOString(),
        startedAt: job.startedAt?.toISOString() ?? null,
        pipelineStage: job.pipelineStage,
      })),
      skippedVideoIdsWithOtherActiveJobs: staleVideoIds.filter((id) => protectedVideoIds.has(id)),
    });
  }

  const [jobUpdateResult, videoUpdateResult] = await prisma.$transaction([
    prisma.transcodeJob.updateMany({
      where: {
        id: { in: staleJobIds },
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "FAILED",
        lastError: staleReason,
        finishedAt: now,
        pipelineStage: null,
      },
    }),
    prisma.video.updateMany({
      where: {
        id: { in: targetVideoIds },
        processingStatus: "PROCESSING",
      },
      data: {
        processingStatus: "FAILED",
        processingError: staleReason,
      },
    }),
  ]);

  console.log(
    `[api/reconcile-stale] staleMinutes=${staleMinutes} cutoff=${cutoff.toISOString()} ` +
    `jobs=${jobUpdateResult.count} videos=${videoUpdateResult.count}`,
  );

  return NextResponse.json({
    success: true,
    dryRun: false,
    staleMinutes,
    cutoff: cutoff.toISOString(),
    reconciledJobs: jobUpdateResult.count,
    reconciledVideos: videoUpdateResult.count,
    skippedVideoIdsWithOtherActiveJobs: staleVideoIds.filter((id) => protectedVideoIds.has(id)),
  });
}
