import { ReactionType } from "@prisma/client";
import { jsonResponse } from "@/lib/api-route";
import { toggleCommentReaction } from "@/lib/server/comments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  let body: { reactionType?: ReactionType | null };

  try {
    body = (await request.json()) as { reactionType?: ReactionType | null };
  } catch {
    return jsonResponse({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const reactionType =
    body.reactionType === "LIKE" || body.reactionType === "DISLIKE" ? body.reactionType : undefined;

  try {
    await toggleCommentReaction(commentId, reactionType, request.headers);
    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "评论互动失败";
    const status = message === "未登录" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
