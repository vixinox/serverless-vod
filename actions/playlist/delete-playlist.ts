"use server";

import { headers } from "next/headers";
import { deletePlaylist as deletePlaylistInternal } from "@/lib/server/playlists";

export async function deletePlaylist(playlistId: string) {
  return deletePlaylistInternal(playlistId, await headers());
}
