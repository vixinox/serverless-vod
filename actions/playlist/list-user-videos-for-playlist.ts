"use server";

import { headers } from "next/headers";
import { listUserVideosForPlaylist as listUserVideosForPlaylistInternal } from "@/lib/server/playlists";

export async function listUserVideosForPlaylist(searchTerm?: string) {
  return listUserVideosForPlaylistInternal(searchTerm, await headers());
}
