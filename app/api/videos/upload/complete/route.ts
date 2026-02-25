import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createHlsOutputPrefix,
  enqueueTranscodeJob,
  ensureBucket,
  localstackConfig,
} from "@/lib/localstack";
import prisma from "@/lib/prisma";

type CompleteUploadBody = {
  videoId?: string;
  uploadSessionId?: string;
};

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as CompleteUploadBody;
    const videoId = body.videoId?.trim();
    const uploadSessionId = body.uploadSessionId?.trim();

    if (!videoId || !uploadSessionId) {
      return NextResponse.json({ message: "videoId 和 uploadSessionId 必填" }, { status: 400 });
    }

    const uploadSession = await prisma.uploadSession.findUnique({
      where: { id: uploadSessionId },
      select: {
        id: true,
        videoId: true,
        uploaderId: true,
        objectKey: true,
        storageBucket: true,
      },
    });

    if (!uploadSession || uploadSession.videoId !== videoId || uploadSession.uploaderId !== session.user.id) {
      return NextResponse.json({ message: "上传会话不存在" }, { status: 404 });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        shortCode: true,
      },
    });

    if (!video) {
      return NextResponse.json({ message: "视频不存在" }, { status: 404 });
    }

    const outputPrefix = createHlsOutputPrefix(video.shortCode);
    await ensureBucket(localstackConfig.hlsBucket);

    const job = await prisma.transcodeJob.create({
      data: {
        videoId,
        provider: "LOCALSTACK",
        inputBucket: uploadSession.storageBucket,
        inputKey: uploadSession.objectKey,
        outputBucket: localstackConfig.hlsBucket,
        outputPrefix,
        status: "QUEUED",
      },
      select: {
        id: true,
      },
    });

    const queued = await enqueueTranscodeJob({
      jobId: job.id,
      videoId,
      shortCode: video.shortCode,
      requestedAt: new Date().toISOString(),
    });

    await prisma.$transaction([
      prisma.uploadSession.update({
        where: { id: uploadSession.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
        },
      }),
      prisma.video.update({
        where: { id: videoId },
        data: {
          processingStatus: "PROCESSING",
          processingError: null,
        },
      }),
      prisma.transcodeJob.update({
        where: { id: job.id },
        data: {
          queueMessageId: queued.messageId,
        },
      }),
    ]);

    return NextResponse.json({
      videoId,
      shortCode: video.shortCode,
      jobId: job.id,
      queueMessageId: queued.messageId,
      status: "QUEUED",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "完成上传失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}