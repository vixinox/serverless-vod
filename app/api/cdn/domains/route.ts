import { jsonResponse } from "@/lib/api-route";
import { getCdnDomains } from "@/lib/server/videos";

export async function GET() {
  return jsonResponse(await getCdnDomains());
}
