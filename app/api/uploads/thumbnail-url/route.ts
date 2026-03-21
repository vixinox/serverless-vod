import {
  createRouteErrorResponse,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { getThumbnailUploadUrl } from "@/lib/server/videos";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      filename?: string;
      contentType?: string;
      shortCode?: string;
    }>(request);
    const result = await getThumbnailUploadUrl(
      requireTrimmedString(body.filename, "缺少上传参数"),
      requireTrimmedString(body.contentType, "缺少上传参数"),
      requireTrimmedString(body.shortCode, "缺少上传参数"),
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "获取缩略图上传地址失败");
  }
}
