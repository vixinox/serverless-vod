import { jsonResponse } from "@/lib/api-route";
import { getRecommendation } from "@/lib/server/videos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit");
  const excluded = url.searchParams.get("exclude");

  const excludeShortCodes = excluded
    ? excluded.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  const videos = await getRecommendation(limit ? Number(limit) : 20, excludeShortCodes);
  return jsonResponse(videos);
}
