'use server'

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createHlsOutputPrefix,
  startTranscodeExecution,
  ensureBucket,
  localstackConfig,
} from "@/lib/localstack";
import prisma from "@/lib/prisma";
import type { Video } from "@prisma/client";

/**
 *
 * @param _filename  文件名（保留参数，保持与上传对话框调用签名一致）
 * @param shortCode  视频的 shortCode，用于定位视频与上传会话
 * @returns 更新后的完整 Video 记录
 */
export async function createVideo(_filename: string, shortCode: string): Promise<Video> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const video = await prisma.video.findUnique({
    where: { shortCode, userId: session.user.id },
  });
  if (!video) throw new Error("视频不存在");

  const uploadSession = await prisma.uploadSession.findFirst({
    where: {
      videoId: video.id,
      uploaderId: session.user.id,
      status: "INITIATED",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      objectKey: true,
      storageBucket: true,
    },
  });
  if (!uploadSession) throw new Error("未找到有效的上传会话");

  const outputPrefix = createHlsOutputPrefix(video.shortCode);
  await ensureBucket(localstackConfig.hlsBucket);

  const job = await prisma.transcodeJob.create({
    data: {
      videoId: video.id,
      provider: "LOCALSTACK",
      inputBucket: uploadSession.storageBucket,
      inputKey: uploadSession.objectKey,
      outputBucket: localstackConfig.hlsBucket,
      outputPrefix,
      status: "QUEUED",
    },
    select: { id: true },
  });

  const execution = await startTranscodeExecution({
    jobId: job.id,
    videoId: video.id,
    shortCode: video.shortCode,
    inputBucket: uploadSession.storageBucket,
    inputKey: uploadSession.objectKey,
    outputBucket: localstackConfig.hlsBucket,
    outputPrefix,
    videoType: video.type as "LONG" | "SHORT",
  });

  await prisma.$transaction([
    prisma.uploadSession.update({
      where: { id: uploadSession.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    }),
    prisma.video.update({
      where: { id: video.id },
      data: { processingStatus: "PROCESSING", processingError: null },
    }),
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: { queueMessageId: execution.executionArn },
    }),
  ]);

  return prisma.video.findUniqueOrThrow({ where: { id: video.id } });
}
