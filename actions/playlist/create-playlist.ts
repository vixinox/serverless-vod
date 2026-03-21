"use server";

import { headers } from "next/headers";
import { createPlaylist as createPlaylistInternal } from "@/lib/server/playlists";

export async function createPlaylist(params: {
  title: string;
  description?: string;
  isPublic?: boolean;
}) {
  return createPlaylistInternal(params, await headers());
}
