import { jsonResponse } from "@/lib/api-route";
import { toggleSystemPlaylistVideo } from "@/lib/server/playlists";
import {
  isSystemPlaylistKey,
  type SystemPlaylistKey,
  WATCH_LATER_PLAYLIST_KEY,
} from "@/lib/system-playlists";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  let playlistKey: SystemPlaylistKey = WATCH_LATER_PLAYLIST_KEY;

  try {
    const rawBody = await request.text();

    if (rawBody.trim()) {
      const body = JSON.parse(rawBody) as { playlistKey?: unknown };

      if (body.playlistKey !== undefined) {
        if (!isSystemPlaylistKey(body.playlistKey)) {
          return jsonResponse({ error: "playlistKey 不合法" }, { status: 400 });
        }

        playlistKey = body.playlistKey;
      }
    }
  } catch {
    return jsonResponse({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  try {
    const result = await toggleSystemPlaylistVideo(shortCode, playlistKey, request.headers);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    const status = message === "未登录" ? 401 : message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
