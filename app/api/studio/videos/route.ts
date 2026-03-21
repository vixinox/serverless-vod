import {
  createRouteErrorResponse,
  getOptionalTrimmedSearchParam,
  getPositiveIntSearchParam,
  jsonResponse,
} from "@/lib/api-route";
import { listUserVideos } from "@/lib/server/videos";

export async function GET(request: Request) {
  const url = new URL(request.url);

  try {
    const result = await listUserVideos(
      {
        page: getPositiveIntSearchParam(url, "page", 1),
        pageSize: getPositiveIntSearchParam(url, "pageSize", 10),
        searchTerm: getOptionalTrimmedSearchParam(url, "searchTerm"),
        categoryId: getOptionalTrimmedSearchParam(url, "categoryId"),
        visibility: getOptionalTrimmedSearchParam(url, "visibility"),
      },
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "读取视频列表失败");
  }
}
