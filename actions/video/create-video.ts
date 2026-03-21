'use server';

import { headers } from "next/headers";
import { createVideo as createVideoMutation } from "@/lib/server/videos";

export async function createVideo(filename: string, shortCode: string) {
  return createVideoMutation(filename, shortCode, await headers());
}
