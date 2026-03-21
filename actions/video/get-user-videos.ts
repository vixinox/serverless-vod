"use server";

import { headers } from "next/headers";
import { listUserVideos as listUserVideosInternal } from "@/lib/server/videos";

interface ListUserVideosParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  categoryId?: string;
  visibility?: string;
}

export async function listUserVideos(params: ListUserVideosParams) {
  return listUserVideosInternal(params, await headers());
}
