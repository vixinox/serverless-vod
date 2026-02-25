import { NextResponse } from "next/server";
import { createPlaybackSignedUrl, localstackConfig } from "@/lib/localstack";
import prisma from "@/lib/prisma";

type Context = {
  params: Promise<{ shortCode: string }>;
};

export async function GET(_: Request, context: Context) {
  try {
    const { shortCode } = await context.params;

    const video = await prisma.video.findUnique({
      where: { shortCode },
      select: {
        id: true,
        shortCode: true,
        processingStatus: true,
        processingError: true,
        readyAt: true,
      },
    });

    if (!video) {
      return NextResponse.json({ message: "视频不存在" }, { status: 404 });
    }

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

    return NextResponse.json({
      videoId: video.id,
      shortCode: video.shortCode,
      processingStatus: video.processingStatus,
      processingError: video.processingError,
      readyAt: video.readyAt,
      playbackUrl,
      expectedManifestKey: `hls/${video.shortCode}/master.m3u8`,
      bucket: localstackConfig.hlsBucket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "查询状态失败";
    return NextResponse.json({ message }, { status: 500 });
  }
}