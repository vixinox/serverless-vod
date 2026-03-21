'use server';

import { headers } from "next/headers";
import { toggleSubscribe as toggleSubscribeMutation } from "@/lib/server/channels";

export async function toggleSubscribe(channelId: string) {
  return toggleSubscribeMutation(channelId, await headers());
}
