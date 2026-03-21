"use server";

import { headers } from "next/headers";
import { addVideoToPlaylist as addVideoToPlaylistInternal } from "@/lib/server/playlists";

export async function addVideoToPlaylist(params: {
  playlistId: string;
  videoShortCode: string;
}) {
  return addVideoToPlaylistInternal(params, await headers());
}
