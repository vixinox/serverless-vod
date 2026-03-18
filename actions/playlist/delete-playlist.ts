"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function deletePlaylist(playlistId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  return prisma.playlist.delete({
    where: {
      id: playlistId,
      ownerId: session.user.id,
    },
  });
}
