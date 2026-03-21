import { ThemePreference } from "@prisma/client";
import { jsonResponse } from "@/lib/api-route";
import { getSettings, updateSettings } from "@/lib/server/settings";

export async function GET(request: Request) {
  const settings = await getSettings(request.headers);
  return jsonResponse(settings);
}

export async function PATCH(request: Request) {
  let body: { theme?: ThemePreference };

  try {
    body = (await request.json()) as { theme?: ThemePreference };
  } catch {
    return jsonResponse({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  if (!body.theme || !["LIGHT", "DARK", "SYSTEM"].includes(body.theme)) {
    return jsonResponse({ error: "主题设置不合法" }, { status: 400 });
  }

  try {
    await updateSettings({ theme: body.theme }, request.headers);
    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存设置失败";
    const status = message === "未登录" ? 401 : 400;
    return jsonResponse({ error: message }, { status });
  }
}
