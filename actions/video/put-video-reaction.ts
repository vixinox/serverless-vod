'use server';

import { ReactionType } from "@prisma/client";
import { headers } from "next/headers";
import { putVideoReaction as putVideoReactionMutation } from "@/lib/server/videos";

export async function putVideoReaction(shortCode: string, reactionType?: ReactionType) {
  return putVideoReactionMutation(shortCode, reactionType, await headers());
}
