import { jsonResponse } from "@/lib/api-route";
import { addComment, getComments, type NextCursor } from "@/lib/server/comments";

function parseCursor(value: string | null): NextCursor | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as {
      id: string;
      createdAt: string;
      likesCount?: number;
    };

    return {
      id: parsed.id,
      createdAt: new Date(parsed.createdAt),
      ...(typeof parsed.likesCount === "number" ? { likesCount: parsed.likesCount } : {}),
    };
  } catch {
    return undefined;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  const url = new URL(request.url);
  const order = url.searchParams.get("order") === "LATEST" ? "LATEST" : "POPULAR";
  const limit = url.searchParams.get("limit");

  try {
    const result = await getComments(
      shortCode,
      order,
      limit ? Number(limit) : 20,
      parseCursor(url.searchParams.get("cursor")),
      request.headers,
    );

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取评论失败";
    const status = message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
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
    const comment = await addComment(shortCode, body.content, request.headers);
    return jsonResponse(comment);
  } catch (error) {
    const message = error instanceof Error ? error.message : "发表评论失败";
    const status = message === "未登录" ? 401 : message === "视频不存在" ? 404 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
