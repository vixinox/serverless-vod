'use server';

import { PlaybackEventType } from "@prisma/client";
import * as z from "zod";
import { headers } from "next/headers";
import { recordPlaybackEvent as recordPlaybackEventMutation } from "@/lib/server/videos";

const recordPlaybackEventSchema = z.object({
  shortCode: z.string().min(1),
  sessionId: z.string().min(1),
  eventType: z.enum(["PLAY_START", "ENDED"]),
  positionSeconds: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
});

export async function recordPlaybackEvent(params: {
  shortCode: string;
  sessionId: string;
  eventType: PlaybackEventType;
  positionSeconds?: number;
  durationSeconds?: number;
}) {
  const parsed = recordPlaybackEventSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`播放记录参数不合法: ${parsed.error.message}`);
  }

  await recordPlaybackEventMutation(parsed.data, await headers());
}
