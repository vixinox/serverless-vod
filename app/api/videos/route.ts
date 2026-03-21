import { NextResponse } from "next/server";
import { jsonResponse } from "@/lib/api-route";
import { createVideo, getVideos } from "@/lib/server/videos";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const limit = url.searchParams.get("limit");
  const typeParam = url.searchParams.get("type");
  const type = typeParam === "SHORT" ? "SHORT" : "LONG";

  const result = await getVideos({
    cursor: cursor ?? undefined,
    limit: limit ? Number(limit) : undefined,
    type,
  });

  return jsonResponse(result);
}

export async function POST(request: Request) {
  let body: { filename?: string; shortCode?: string };

  try {
    body = (await request.json()) as { filename?: string; shortCode?: string };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.shortCode) {
    return NextResponse.json({ error: "缺少 shortCode" }, { status: 400 });
  }

  try {
    const video = await createVideo(body.filename ?? "", body.shortCode, request.headers);
    return jsonResponse(video);
  } catch (error) {
    const message = error instanceof Error ? error.message : "创建视频失败";
    const status = message === "未登录" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
