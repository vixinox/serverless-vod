'use server'

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createRawVideoObjectKey,
  createUploadPresignedUrl,
  ensureBucket,
  localstackConfig,
} from "@/lib/localstack";
import prisma from "@/lib/prisma";
import { createUploadVideoDraft } from "@/lib/video-pipeline";

function normalizeTitle(raw: string) {
  return raw.trim().slice(0, 120) || "未命名视频";
}

export type VideoUploadUrlResult = {
  /** S3 预签名 PUT 地址，客户端直传用 */
  url: string;
  shortCode: string;
  videoId: string;
  uploadSessionId: string;
};

/**
 * 初始化视频上传：创建草稿记录、上传会话，并返回预签名 PUT URL。
 * 对应原 POST /api/videos/upload/init
 */
export async function getVideoUploadUrl(
  filename: string,
  contentType: string,
  videoType: "LONG" | "SHORT" = "LONG",
  title?: string,
): Promise<VideoUploadUrlResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const safeName = filename.trim() || "upload.mp4";
  const safeContentType = contentType.trim() || "video/mp4";
  const resolvedTitle = normalizeTitle(title ?? safeName.replace(/\.[^.]+$/, ""));

  // 先验证存储桶可达，避免草稿已写入 DB 后因 LocalStack 未启动而产生
  // processingStatus=UPLOADING 的孤儿记录
  await ensureBucket(localstackConfig.rawBucket);

  const draft = await createUploadVideoDraft({
    userId: session.user.id,
    title: resolvedTitle,
    filename: safeName,
    type: videoType,
  });

  const objectKey = createRawVideoObjectKey(draft.shortCode);

  const presignedUrl = await createUploadPresignedUrl({
    bucket: localstackConfig.rawBucket,
    key: objectKey,
    contentType: safeContentType,
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
    select: { id: true },
  });

  return {
    url: presignedUrl,
    shortCode: draft.shortCode,
    videoId: draft.id,
    uploadSessionId: uploadSession.id,
  };
}

/**
 * 获取缩略图上传预签名 URL，客户端直传至 image 存储桶。
 */
export async function getThumbnailUploadUrl(
  filename: string,
  contentType: string,
  shortCode: string,
): Promise<{ url: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const ext = filename.includes(".") ? filename.split(".").pop() : "jpg";
  const objectKey = `thumbnails/${shortCode}/thumbnail.${ext}`;

  await ensureBucket(localstackConfig.imageBucket);

  const url = await createUploadPresignedUrl({
    bucket: localstackConfig.imageBucket,
    key: objectKey,
    contentType,
  });

  return { url };
}
