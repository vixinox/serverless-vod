"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as z from "zod";

const createPlaylistSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export async function createPlaylist(params: {
  title: string;
  description?: string;
  isPublic?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const parsed = createPlaylistSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { title, description, isPublic = true } = parsed.data;

  return prisma.playlist.create({
    data: {
      ownerId: session.user.id,
      title,
      description,
      isPublic,
    },
  });
}
