import { Visibility } from "@prisma/client";
import {
  createRouteErrorResponse,
  jsonResponse,
  readJsonBody,
  requireTrimmedString,
} from "@/lib/api-route";
import { deleteVideo, editVideo } from "@/lib/server/videos";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  try {
    const { shortCode } = await params;
    const body = await readJsonBody<{
      title?: string;
      description?: string;
      thumbnail?: string;
      visibility?: Visibility;
    }>(request);
    const result = await editVideo(
      {
        shortCode: requireTrimmedString(shortCode, "缺少 shortCode"),
        title: body.title,
        description: body.description,
        thumbnail: body.thumbnail,
        visibility: body.visibility,
      },
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "更新视频失败");
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  try {
    const { shortCode } = await params;
    const result = await deleteVideo(
      requireTrimmedString(shortCode, "缺少 shortCode"),
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "删除视频失败");
  }
}
