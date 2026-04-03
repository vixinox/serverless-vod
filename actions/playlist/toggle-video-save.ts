'use server';

import { headers } from "next/headers";
import { toggleSystemPlaylistVideo } from "@/lib/server/playlists";
import {
  type SystemPlaylistKey,
  WATCH_LATER_PLAYLIST_KEY,
} from "@/lib/system-playlists";

export async function toggleVideoSave(
  shortCode: string,
  playlistKey: SystemPlaylistKey = WATCH_LATER_PLAYLIST_KEY,
) {
  return toggleSystemPlaylistVideo(shortCode, playlistKey, await headers());
}
