import {
  createRouteErrorResponse,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { deletePlaylist, updatePlaylist } from "@/lib/server/playlists";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const body = await readJsonBody<{
      title?: string;
      description?: string;
      isPublic?: boolean;
    }>(request);
    const result = await updatePlaylist(
      {
        playlistId: requireTrimmedString(playlistId, "缺少 playlistId"),
        title: body.title,
        description: body.description,
        isPublic: body.isPublic,
      },
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "更新播放列表失败");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ playlistId: string }> },
) {
  try {
    const { playlistId } = await params;
    const result = await deletePlaylist(
      requireTrimmedString(playlistId, "缺少 playlistId"),
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "删除播放列表失败");
  }
}
