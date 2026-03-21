"use server";

import { headers } from "next/headers";
import { retryVideoJob as retryVideoJobInternal } from "@/lib/server/videos";

export async function retryVideoJob(shortCode: string) {
  return retryVideoJobInternal(shortCode, await headers());
}
