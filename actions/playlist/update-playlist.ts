"use server";

import { headers } from "next/headers";
import { updatePlaylist as updatePlaylistInternal } from "@/lib/server/playlists";

export async function updatePlaylist(params: {
  playlistId: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
}) {
  return updatePlaylistInternal(params, await headers());
}
