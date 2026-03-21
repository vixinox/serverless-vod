import { jsonResponse } from "@/lib/api-route";
import { toggleSubscribe } from "@/lib/server/channels";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const { channelId } = await params;

  try {
    const result = await toggleSubscribe(channelId, request.headers);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "订阅失败";
    const status = message === "未登录" ? 401 : message === "频道不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
