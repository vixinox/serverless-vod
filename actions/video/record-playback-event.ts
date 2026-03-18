'use server';

import { headers } from "next/headers";
import { PlaybackEventType } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as z from "zod";

const recordPlaybackEventSchema = z.object({
  videoId: z.string().min(1),
  sessionId: z.string().min(1),
  eventType: z.enum(["PLAY_START", "ENDED"]),
  positionSeconds: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export async function recordPlaybackEvent(params: {
  videoId: string;
  sessionId: string;
  eventType: PlaybackEventType;
  positionSeconds?: number;
  durationSeconds?: number;
}) {
  const parsed = recordPlaybackEventSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`播放记录参数不合法: ${parsed.error.message}`);
  }

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders }).catch(() => null);

  const video = await prisma.video.findUnique({
    where: {
      id: parsed.data.videoId,
    },
    select: {
      id: true,
      deletedAt: true,
    },
  });

  if (!video || video.deletedAt) {
    return;
  }

  await prisma.videoPlaybackEvent.create({
    data: {
      videoId: parsed.data.videoId,
      userId: session?.user?.id ?? null,
      sessionId: parsed.data.sessionId,
      eventType: parsed.data.eventType,
      positionSeconds: parsed.data.positionSeconds,
      durationSeconds: parsed.data.durationSeconds,
      referrer: requestHeaders.get("referer") ?? undefined,
      userAgent: requestHeaders.get("user-agent") ?? undefined,
      source: "web",
    },
  });
}
