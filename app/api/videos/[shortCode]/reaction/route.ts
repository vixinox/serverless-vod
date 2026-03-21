import { ReactionType } from "@prisma/client";
import { jsonResponse } from "@/lib/api-route";
import { putVideoReaction } from "@/lib/server/videos";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  let body: { reactionType?: ReactionType | null };

  try {
    body = (await request.json()) as { reactionType?: ReactionType | null };
  } catch {
    return jsonResponse({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const reactionType =
    body.reactionType === "LIKE" || body.reactionType === "DISLIKE" ? body.reactionType : undefined;

  try {
    const result = await putVideoReaction(shortCode, reactionType, request.headers);
    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "操作失败";
    const status = message === "未登录" ? 401 : message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
