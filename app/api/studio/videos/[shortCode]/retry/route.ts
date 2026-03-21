import { createRouteErrorResponse, jsonResponse, requireTrimmedString } from "@/lib/api-route";
import { retryVideoJob } from "@/lib/server/videos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  try {
    const { shortCode } = await params;
    const result = await retryVideoJob(
      requireTrimmedString(shortCode, "缺少 shortCode"),
      request.headers,
    );
    return jsonResponse(result);
  } catch (error) {
    return createRouteErrorResponse(error, "重试任务失败");
  }
}
