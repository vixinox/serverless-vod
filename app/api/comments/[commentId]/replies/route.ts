import { jsonResponse } from "@/lib/api-route";
import { addReply, getReplies, type ReplyCursor } from "@/lib/server/comments";

function parseCursor(value: string | null): ReplyCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as { id: string; createdAt: string };
    return {
      id: parsed.id,
      createdAt: new Date(parsed.createdAt),
    };
  } catch {
    return undefined;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");

  try {
    const result = await getReplies(
      commentId,
      parseCursor(url.searchParams.get("cursor")),
      limit ? Number(limit) : 10,
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取回复失败";
    return jsonResponse({ error: message }, { status: 400 });
  }
}

export async function POST(
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
    return jsonResponse({ error: "回复内容不能为空" }, { status: 400 });
  }

  try {
    const reply = await addReply(commentId, body.content, request.headers);
    return jsonResponse(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "回复失败";
    const status = message === "未登录" ? 401 : message === "评论不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
