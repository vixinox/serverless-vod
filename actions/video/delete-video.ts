"use server";

import { headers } from "next/headers";
import { deleteVideo as deleteVideoInternal } from "@/lib/server/videos";

export async function deleteVideo(shortCode: string) {
  return deleteVideoInternal(shortCode, await headers());
}
