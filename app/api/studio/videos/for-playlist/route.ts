import { createRouteErrorResponse, getOptionalTrimmedSearchParam, jsonResponse } from "@/lib/api-route";
import { listUserVideosForPlaylist } from "@/lib/server/playlists";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const searchTerm = getOptionalTrimmedSearchParam(url, "searchTerm");

  try {
    const result = await listUserVideosForPlaylist(searchTerm, request.headers);
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "读取视频列表失败");
  }
}
