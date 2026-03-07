'use server'

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export type JobTimelineItem = {
  id: string;
  status: string;
  attempt: number;
  maxAttempts: number;
  pipelineStage: string | null;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  wallSeconds: number | null;
};

export type VideoJobTimeline = {
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  jobs: JobTimelineItem[];
};

function clampLimit(input: number | undefined) {
  const value = typeof input === "number" ? Math.floor(input) : 5;
  return Math.min(Math.max(value, 1), 12);
}

export async function getVideoJobTimeline(
  shortCode: string,
  limit?: number,
): Promise<VideoJobTimeline> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const safeShortCode = shortCode.trim();
  if (!safeShortCode) throw new Error("shortCode 不能为空");

  const video = await prisma.video.findFirst({
    where: {
      shortCode: safeShortCode,
      userId: session.user.id,
      deletedAt: null,
    },
    select: {
      shortCode: true,
      processingStatus: true,
      processingError: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: clampLimit(limit),
        select: {
          id: true,
          status: true,
          attempt: true,
          maxAttempts: true,
          pipelineStage: true,
          lastError: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  if (!video) throw new Error("视频不存在");

  const now = Date.now();
  const jobs = video.transcodeJobs.map((job) => {
    const endAt = job.finishedAt?.getTime() ?? now;
    const wallMs = endAt - job.queuedAt.getTime();

    return {
      id: job.id,
      status: job.status,
      attempt: job.attempt,
      maxAttempts: job.maxAttempts,
      pipelineStage: job.pipelineStage,
      lastError: job.lastError,
      queuedAt: job.queuedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
      wallSeconds: wallMs >= 0 ? Math.floor(wallMs / 1000) : null,
    };
  });

  return {
    shortCode: video.shortCode,
    processingStatus: video.processingStatus,
    processingError: video.processingError,
    jobs,
  };
}
