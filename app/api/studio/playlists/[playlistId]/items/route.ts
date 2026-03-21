import {
  createRouteErrorResponse,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { addVideoToPlaylist, listPlaylistItems } from "@/lib/server/playlists";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const items = await listPlaylistItems(
      requireTrimmedString(playlistId, "缺少 playlistId"),
      request.headers,
    );
    return jsonResponse(items);
  } catch (error) {
    return createRouteErrorResponse(error, "读取播放列表内容失败");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = await readJsonBody<{
      videoShortCode?: string;
    }>(request);
    const result = await addVideoToPlaylist(
      {
        playlistId: requireTrimmedString(playlistId, "缺少 playlistId"),
        videoShortCode: requireTrimmedString(body.videoShortCode, "缺少 videoShortCode"),
      },
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "添加视频失败");
  }
}
