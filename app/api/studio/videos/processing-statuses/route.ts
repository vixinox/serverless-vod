import { createRouteErrorResponse, jsonResponse } from "@/lib/api-route";
import { getProcessingStatuses } from "@/lib/server/videos";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shortCodes = url.searchParams.getAll("shortCode").map((item) => item.trim()).filter(Boolean);

  try {
    const statuses = await getProcessingStatuses(shortCodes, request.headers);
    return jsonResponse(statuses);
  } catch (error) {
    return createRouteErrorResponse(error, "读取处理状态失败");
  }
}
