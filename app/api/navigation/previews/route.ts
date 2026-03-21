import { jsonResponse } from "@/lib/api-route";
import { getSavedPreviewVideos } from "@/lib/server/playlists";
import { getHistoryPreviewVideos } from "@/lib/server/videos";

function mapPreviewItem(
  item: {
    id: string;
    shortCode: string;
    title: string;
    thumbnail: string;
    ownerName: string;
  },
  activityAt: Date,
  activityLabel: string,
) {
  return {
    id: item.id,
    shortCode: item.shortCode,
    title: item.title,
    thumbnail: item.thumbnail,
    ownerName: item.ownerName,
    activityAt,
    activityLabel,
  };
}

export async function GET(request: Request) {
  const [saved, history] = await Promise.all([
    getSavedPreviewVideos(3, request.headers),
    getHistoryPreviewVideos(3, request.headers),
  ]);

  return jsonResponse({
    isAuthenticated: Boolean(saved && history),
    saved: {
      items: (saved ?? []).map((item) =>
        mapPreviewItem(item, item.savedAt, "最近收藏"),
      ),
    },
    history: {
      items: (history ?? []).map((item) =>
        mapPreviewItem(item, item.lastWatchedAt, "最近观看"),
      ),
    },
  });
}
