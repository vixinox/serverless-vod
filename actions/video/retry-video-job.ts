'use server'

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import {
  createHlsOutputPrefix,
  ensureBucket,
  localstackConfig,
  startTranscodeExecution,
} from "@/lib/localstack";
import prisma from "@/lib/prisma";

export async function retryVideoJob(shortCode: string) {
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
      id: true,
      shortCode: true,
      type: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          inputBucket: true,
          inputKey: true,
          maxAttempts: true,
        },
      },
    },
  });

  if (!video) throw new Error("视频不存在");

  const activeJob = await prisma.transcodeJob.findFirst({
    where: {
      videoId: video.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true },
  });

  if (activeJob) {
    throw new Error("当前已有进行中的任务，暂不可重试");
  }

  const previousJob = video.transcodeJobs[0];
  if (!previousJob) {
    throw new Error("未找到可复用的历史任务输入");
  }

  const outputPrefix = createHlsOutputPrefix(video.shortCode);
  await ensureBucket(localstackConfig.hlsBucket);

  const job = await prisma.transcodeJob.create({
    data: {
      videoId: video.id,
      provider: "LOCALSTACK",
      inputBucket: previousJob.inputBucket,
      inputKey: previousJob.inputKey,
      outputBucket: localstackConfig.hlsBucket,
      outputPrefix,
      status: "QUEUED",
      maxAttempts: previousJob.maxAttempts,
    },
    select: { id: true },
  });

  const execution = await startTranscodeExecution({
    jobId: job.id,
    videoId: video.id,
    shortCode: video.shortCode,
    inputBucket: previousJob.inputBucket,
    inputKey: previousJob.inputKey,
    outputBucket: localstackConfig.hlsBucket,
    outputPrefix,
    videoType: video.type,
  });

  await prisma.$transaction([
    prisma.video.update({
      where: { id: video.id },
      data: {
        processingStatus: "PROCESSING",
        processingError: null,
      },
    }),
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: { queueMessageId: execution.executionArn },
    }),
  ]);

  return {
    shortCode: video.shortCode,
    jobId: job.id,
    executionArn: execution.executionArn,
  };
}
