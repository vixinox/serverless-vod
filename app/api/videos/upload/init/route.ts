import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRawVideoObjectKey, createUploadPresignedUrl, ensureBucket, localstackConfig } from "@/lib/localstack";
import prisma from "@/lib/prisma";
import { createUploadVideoDraft } from "@/lib/video-pipeline";

type InitUploadBody = {
  title?: string;
  filename?: string;
  contentType?: string;
  videoType?: "LONG" | "SHORT";
};

function normalizeTitle(title: string) {
  return title.trim().slice(0, 120) || "未命名视频";
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.id) {
      return NextResponse.json({ message: "未登录" }, { status: 401 });
    }

    const body = (await request.json()) as InitUploadBody;
    const filename = (body.filename ?? "upload.mp4").trim();
    const contentType = (body.contentType ?? "video/mp4").trim();
    const videoType = body.videoType === "SHORT" ? "SHORT" : "LONG";
    const title = normalizeTitle(body.title ?? filename.replace(/\.[^.]+$/, ""));

    const draft = await createUploadVideoDraft({
      userId: session.user.id,
      title,
      filename,
      type: videoType,
    });

    const objectKey = createRawVideoObjectKey(draft.id, filename);

    await ensureBucket(localstackConfig.rawBucket);

    const presignedUrl = await createUploadPresignedUrl({
      bucket: localstackConfig.rawBucket,
      key: objectKey,
      contentType,
    });

    const uploadSession = await prisma.uploadSession.create({
      data: {
        videoId: draft.id,
        uploaderId: session.user.id,
        storageBucket: localstackConfig.rawBucket,
        objectKey,
        status: "INITIATED",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      select: {
        id: true,
      },
    });

    return NextResponse.json({
      videoId: draft.id,
      shortCode: draft.shortCode,
      uploadSessionId: uploadSession.id,
      upload: {
        bucket: localstackConfig.rawBucket,
        key: objectKey,
        contentType,
        presignedUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "初始化上传失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}