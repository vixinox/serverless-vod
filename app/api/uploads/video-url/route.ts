import {
  ApiRouteError,
  createRouteErrorResponse,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { getVideoUploadUrl } from "@/lib/server/videos";

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<{
      filename?: string;
      contentType?: string;
      videoType?: "LONG" | "SHORT";
      title?: string;
    }>(request);
    const videoType = body.videoType ?? "LONG";

    if (videoType !== "LONG" && videoType !== "SHORT") {
      throw new ApiRouteError("videoType 不合法", 400);
    }

    const result = await getVideoUploadUrl(
      requireTrimmedString(body.filename, "缺少上传参数"),
      requireTrimmedString(body.contentType, "缺少上传参数"),
      videoType,
      body.title,
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "获取上传地址失败");
  }
}
