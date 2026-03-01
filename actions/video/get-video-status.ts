'use server'

import { createPlaybackSignedUrl, localstackConfig } from "@/lib/localstack";
import prisma from "@/lib/prisma";

export type VideoStatusResult = {
  videoId: string;
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  readyAt: Date | null;
  playbackUrl: string | null;
  expectedManifestKey: string;
  bucket: string;
};

async function resolveVideoStatus(video: {
  id: string;
  shortCode: string;
  processingStatus: string;
  processingError: string | null;
  readyAt: Date | null;
}): Promise<VideoStatusResult> {
  const primaryManifest = await prisma.videoAsset.findFirst({
    where: {
      videoId: video.id,
      assetType: "HLS_MASTER",
      isPrimary: true,
    },
    select: {
      storageBucket: true,
      storageKey: true,
    },
  });

  let playbackUrl: string | null = null;
  if (primaryManifest) {
    playbackUrl = await createPlaybackSignedUrl({
      bucket: primaryManifest.storageBucket,
      key: primaryManifest.storageKey,
    });
  }

  return {
    videoId: video.id,
    shortCode: video.shortCode,
    processingStatus: video.processingStatus,
    processingError: video.processingError,
    readyAt: video.readyAt,
    playbackUrl,
    expectedManifestKey: `${video.shortCode}/master.m3u8`,
    bucket: localstackConfig.hlsBucket,
  };
}

const videoStatusSelect = {
  id: true,
  shortCode: true,
  processingStatus: true,
  processingError: true,
  readyAt: true,
} as const;

/** 通过 videoId 查询转码处理状态 */
export async function getVideoStatusById(videoId: string): Promise<VideoStatusResult> {
  const video = await prisma.video.findUnique({
    where: { id: videoId },
    select: videoStatusSelect,
  });

  if (!video) throw new Error("视频不存在");

  return resolveVideoStatus(video);
}

/** 通过 shortCode 查询转码处理状态 */
export async function getVideoStatusByShortCode(shortCode: string): Promise<VideoStatusResult> {
  const video = await prisma.video.findUnique({
    where: { shortCode },
    select: videoStatusSelect,
  });

  if (!video) throw new Error("视频不存在");

  return resolveVideoStatus(video);
}
