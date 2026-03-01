'use server'

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";

export async function getVideoDetails(shortCode: string) {
  const session = await auth.api.getSession({
      headers: await headers()
  })

  if (!session?.user) {
    redirect("/login");
  }

  const video = await prisma.video.findUnique({
    where: { shortCode, userId: session?.user?.id },
  });

  if (!video) {
    notFound();
  }

  return video;
}