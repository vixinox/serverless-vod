"use server";

import { headers } from "next/headers";
import { removeVideoFromPlaylist as removeVideoFromPlaylistInternal } from "@/lib/server/playlists";

export async function removeVideoFromPlaylist(params: {
  playlistId: string;
  videoId: string;
}) {
  return removeVideoFromPlaylistInternal(params, await headers());
}
