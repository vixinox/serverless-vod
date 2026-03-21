"use server";

import { headers } from "next/headers";
import { listUserPlaylists as listUserPlaylistsInternal } from "@/lib/server/playlists";

interface ListUserPlaylistsParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
}

export async function listUserPlaylists(params: ListUserPlaylistsParams) {
  return listUserPlaylistsInternal(params, await headers());
}
