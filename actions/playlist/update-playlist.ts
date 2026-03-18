"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import * as z from "zod";

const updatePlaylistSchema = z.object({
  playlistId: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).optional(),
  isPublic: z.boolean().optional(),
});

export async function updatePlaylist(params: {
  playlistId: string;
  title?: string;
  description?: string;
  isPublic?: boolean;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const parsed = updatePlaylistSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { playlistId, title, description, isPublic } = parsed.data;

  return prisma.playlist.update({
    where: {
      id: playlistId,
      ownerId: session.user.id,
    },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
      updatedAt: new Date(),
    },
  });
}
