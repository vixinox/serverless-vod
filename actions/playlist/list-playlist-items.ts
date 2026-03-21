"use server";

import { headers } from "next/headers";
import { listPlaylistItems as listPlaylistItemsInternal } from "@/lib/server/playlists";

export async function listPlaylistItems(playlistId: string) {
  return listPlaylistItemsInternal(playlistId, await headers());
}
