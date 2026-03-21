'use server';

import { headers } from "next/headers";
import {
  getThumbnailUploadUrl as getThumbnailUploadUrlQuery,
  getVideoUploadUrl as getVideoUploadUrlQuery,
} from "@/lib/server/videos";

export async function getVideoUploadUrl(
  filename: string,
  contentType: string,
  videoType: "LONG" | "SHORT" = "LONG",
  title?: string,
) {
  return getVideoUploadUrlQuery(filename, contentType, videoType, title, await headers());
}

export async function getThumbnailUploadUrl(
  filename: string,
  contentType: string,
  shortCode: string,
) {
  return getThumbnailUploadUrlQuery(filename, contentType, shortCode, await headers());
}
