'use server'

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { stopTranscodeExecution } from "@/lib/localstack";
import prisma from "@/lib/prisma";

const CANCEL_REASON = "Canceled by studio user";

export async function cancelVideoJob(shortCode: string) {
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
    select: { id: true, shortCode: true, processingStatus: true },
  });
  if (!video) throw new Error("视频不存在");

  const activeJob = await prisma.transcodeJob.findFirst({
    where: {
      videoId: video.id,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      queueMessageId: true,
    },
  });

  // 没有活跃 Job，但视频仍卡在中间态（例如 LocalStack 未启动导致上传初始化失败）
  // 直接将视频收敛到 FAILED，让用户可以重新上传
  if (!activeJob) {
    if (video.processingStatus === "UPLOADING" || video.processingStatus === "PROCESSING") {
      await prisma.video.update({
        where: { id: video.id },
        data: { processingStatus: "FAILED", processingError: CANCEL_REASON },
      });
      return { shortCode: video.shortCode, jobId: null, status: "CANCELED" };
    }
    throw new Error("未找到可取消的任务");
  }

  if (activeJob.queueMessageId) {
    try {
      await stopTranscodeExecution(activeJob.queueMessageId, CANCEL_REASON);
    } catch {
      // Execution may already be terminal; local record still should be reconciled.
    }
  }

  await prisma.transcodeJob.update({
    where: { id: activeJob.id },
    data: {
      status: "CANCELED",
      finishedAt: new Date(),
      pipelineStage: null,
      lastError: CANCEL_REASON,
    },
  });

  const otherActiveCount = await prisma.transcodeJob.count({
    where: {
      videoId: video.id,
      id: { not: activeJob.id },
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (otherActiveCount === 0) {
    await prisma.video.update({
      where: { id: video.id },
      data: {
        processingStatus: "FAILED",
        processingError: CANCEL_REASON,
      },
    });
  }

  return {
    shortCode: video.shortCode,
    jobId: activeJob.id,
    status: "CANCELED",
  };
}
