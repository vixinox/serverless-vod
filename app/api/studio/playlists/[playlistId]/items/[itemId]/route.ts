import { createRouteErrorResponse, jsonResponse, requireTrimmedString } from "@/lib/api-route";
import { removePlaylistItem } from "@/lib/server/playlists";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string; itemId: string }> },
) {
  try {
    const { playlistId, itemId } = await params;
    requireTrimmedString(playlistId, "缺少 playlistId");
    await removePlaylistItem(
      requireTrimmedString(itemId, "缺少 itemId"),
      request.headers,
    );
    return jsonResponse({ success: true });
  } catch (error) {
    return createRouteErrorResponse(error, "移除视频失败");
  }
}
