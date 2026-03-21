"use server";

import { Visibility } from "@prisma/client";
import { headers } from "next/headers";
import { editVideo as editVideoInternal } from "@/lib/server/videos";

export async function editVideo(params: {
  shortCode: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  visibility?: Visibility;
}) {
  return editVideoInternal(params, await headers());
}
