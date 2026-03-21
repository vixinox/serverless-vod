import { createRouteErrorResponse, jsonResponse, requireTrimmedString } from "@/lib/api-route";
import { cancelVideoJob } from "@/lib/server/videos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  try {
    const { shortCode } = await params;
    const result = await cancelVideoJob(
      requireTrimmedString(shortCode, "缺少 shortCode"),
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "取消任务失败");
  }
}
