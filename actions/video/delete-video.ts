'use server'

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";

export async function deleteVideo(shortCode: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  return prisma.video.update({
    where: { shortCode, userId: session.user.id, deletedAt: null },
    data: { deletedAt: new Date() }
  });
}