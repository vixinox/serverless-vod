'use server';

import { headers } from "next/headers";
import { toggleVideoSave as toggleVideoSaveMutation } from "@/lib/server/playlists";

export async function toggleVideoSave(shortCode: string) {
  return toggleVideoSaveMutation(shortCode, await headers());
}
