import { jsonResponse } from "@/lib/api-route";
import { deleteComment, updateComment } from "@/lib/server/comments";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  let body: { content?: string };

  try {
    body = (await request.json()) as { content?: string };
  } catch {
    return jsonResponse({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.content) {
    return jsonResponse({ error: "评论内容不能为空" }, { status: 400 });
  }

  try {
    await updateComment(commentId, body.content, request.headers);
    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "更新评论失败";
    const status =
      message === "未登录" ? 401 : message === "评论不存在" ? 404 : message.includes("权限") ? 403 : 400;
    return jsonResponse({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;

  try {
    await deleteComment(commentId, request.headers);
    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "删除评论失败";
    const status =
      message === "未登录" ? 401 : message === "评论不存在" ? 404 : message.includes("权限") ? 403 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
