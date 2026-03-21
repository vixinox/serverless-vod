import { jsonResponse } from "@/lib/api-route";
import { toggleVideoSave } from "@/lib/server/playlists";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;

  try {
    const result = await toggleVideoSave(shortCode, request.headers);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败";
    const status = message === "未登录" ? 401 : message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
