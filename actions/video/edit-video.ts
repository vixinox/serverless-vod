'use server'

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { Visibility } from "@prisma/client";
import * as z from "zod";

const editVideoSchema = z.object({
  shortCode: z.string().min(1),
  title: z.string().min(1).max(150).optional(),
  description: z.string().max(5000).optional(),
  thumbnail: z.string().optional(),
  visibility: z.enum(Visibility).optional(),
});

export async function editVideo(params: {
  shortCode: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  visibility?: Visibility;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) redirect("/login");

  const parsed = editVideoSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  const { shortCode, title, description, thumbnail, visibility } = parsed.data;

  return prisma.video.update({
    where: { shortCode, userId: session.user.id, deletedAt: null },
    data: {
      ...(title && { title }),
      ...(description && { description }),
      ...(thumbnail && { thumbnail }),
      ...(visibility && { visibility }),
      updatedAt: new Date(),
    },
  });
}