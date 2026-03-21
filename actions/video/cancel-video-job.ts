"use server";

import { headers } from "next/headers";
import { cancelVideoJob as cancelVideoJobInternal } from "@/lib/server/videos";

export async function cancelVideoJob(shortCode: string) {
  return cancelVideoJobInternal(shortCode, await headers());
}
