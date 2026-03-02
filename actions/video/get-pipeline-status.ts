'use server'

import prisma from "@/lib/prisma";

export type PipelineStatus = {
  processingStatus: string;
  jobId: string | null;
  jobStatus: string | null;
  jobError: string | null;
  attempt: number;
  maxAttempts: number;
  /**
   * 当前流水线阶段，仅在 RUNNING 状态下有意义。
   * 可能的值：job_started | downloading | probing | transcoding
   *           uploading_segments | thumbnail_extracting | thumbnail_uploading
   * 完成后为 null。
   */
  pipelineStage: string | null;
  /** Step Functions execution ARN，存储在 TranscodeJob.queueMessageId */
  executionArn: string | null;
  inputKey: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
};

export async function getPipelineStatus(shortCode: string): Promise<PipelineStatus> {
  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: {
      processingStatus: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          lastError: true,
          attempt: true,
          maxAttempts: true,
          pipelineStage: true,
          queueMessageId: true,
          inputKey: true,
          queuedAt: true,
          startedAt: true,
          finishedAt: true,
        },
      },
    },
  });

  if (!video) throw new Error("视频不存在");

  const job = video.transcodeJobs[0] ?? null;

  return {
    processingStatus: video.processingStatus,
    jobId: job?.id ?? null,
    jobStatus: job?.status ?? null,
    jobError: job?.lastError ?? null,
    attempt: job?.attempt ?? 0,
    maxAttempts: job?.maxAttempts ?? 3,
    pipelineStage: job?.pipelineStage ?? null,
    executionArn: job?.queueMessageId ?? null,
    inputKey: job?.inputKey ?? null,
    queuedAt: job?.queuedAt?.toISOString() ?? null,
    startedAt: job?.startedAt?.toISOString() ?? null,
    finishedAt: job?.finishedAt?.toISOString() ?? null,
  };
}
