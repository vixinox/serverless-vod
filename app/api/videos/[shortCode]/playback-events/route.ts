import { PlaybackEventType } from "@prisma/client";
import { NextResponse } from "next/server";
import { recordPlaybackEvent } from "@/lib/server/videos";

/**
 * 播放器的行为事件入口。
 * 前端上报事件类型和播放位置，服务端处理去重、统计和历史记录。
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  let body: {
    sessionId?: string;
    eventType?: PlaybackEventType;
    positionSeconds?: number;
    durationSeconds?: number;
    watchDeltaMs?: number;
    playbackRate?: number;
    isMuted?: boolean;
    volume?: number;
  };

  try {
    body = (await request.json()) as {
      sessionId?: string;
      eventType?: PlaybackEventType;
      positionSeconds?: number;
      durationSeconds?: number;
      watchDeltaMs?: number;
      playbackRate?: number;
      isMuted?: boolean;
      volume?: number;
    };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.sessionId || !body.eventType) {
    return NextResponse.json({ error: "播放事件参数缺失" }, { status: 400 });
  }

  if (
    body.eventType !== "PLAY_START" &&
    body.eventType !== "PLAY_PROGRESS" &&
    body.eventType !== "PAUSE" &&
    body.eventType !== "RESUME" &&
    body.eventType !== "SEEK" &&
    body.eventType !== "ENDED"
  ) {
    return NextResponse.json({ error: "播放事件类型不合法" }, { status: 400 });
  }

  try {
    // 请求头提供用户、来源等统计上下文。
    await recordPlaybackEvent(
      {
        shortCode,
        sessionId: body.sessionId,
        eventType: body.eventType,
        positionSeconds: body.positionSeconds,
        durationSeconds: body.durationSeconds,
        watchDeltaMs: body.watchDeltaMs,
        playbackRate: body.playbackRate,
        isMuted: body.isMuted,
        volume: body.volume,
      },
      request.headers,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "记录播放事件失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
