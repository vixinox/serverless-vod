import {
  createRouteErrorResponse,
  getOptionalTrimmedSearchParam,
  getPositiveIntSearchParam,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { createPlaylist, listUserPlaylists } from "@/lib/server/playlists";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const result = await listUserPlaylists(
      {
        page: getPositiveIntSearchParam(url, "page", 1),
        pageSize: getPositiveIntSearchParam(url, "pageSize", 10),
        searchTerm: getOptionalTrimmedSearchParam(url, "searchTerm"),
        videoShortCode: getOptionalTrimmedSearchParam(url, "videoShortCode"),
      },
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "读取播放列表失败");
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      title?: string;
      description?: string;
      isPublic?: boolean;
    }>(request);
    const result = await createPlaylist(
      {
        title: requireTrimmedString(body.title, "缺少播放列表标题"),
        description: body.description,
        isPublic: body.isPublic,
      },
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "创建播放列表失败");
  }
}
