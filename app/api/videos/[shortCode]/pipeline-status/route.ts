import { jsonResponse } from "@/lib/api-route";
import { getPipelineStatus } from "@/lib/server/videos";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;

  try {
    const result = await getPipelineStatus(shortCode);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取流水线状态失败";
    const status = message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
