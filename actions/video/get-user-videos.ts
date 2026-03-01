"use server";

import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Prisma, Visibility } from "@prisma/client";

interface ListUserVideosParams {
  page: number;
  pageSize: number;
  searchTerm?: string;
  categoryId?: string;
  visibility?: string;
}

export async function listUserVideos(params: ListUserVideosParams) {
  const session = await auth.api.getSession({
    headers: await headers()
  })

  if (!session?.user) {
    redirect("/login");
  }

  const {
    page,
    pageSize,
    searchTerm = "",
    categoryId = "",
    visibility = ""
  } = params;

  const skip = (page - 1) * pageSize;
  const whereConditions: Prisma.VideoWhereInput = {
    userId: session.user.id,
    deletedAt: null,
    ...(searchTerm && {
      title: { contains: searchTerm, mode: Prisma.QueryMode.insensitive },
    }),
    ...(categoryId && { categoryId }),
    ...(visibility && { visibility: visibility as Visibility }),
  };

  const videos = await prisma.video.findMany({
    where: whereConditions,
    skip,
    take: pageSize,
    include: {
      channel: {
        include: {
          owner: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalCount = await prisma.video.count({
    where: whereConditions,
  });

  return {
    videos,
    totalCount,
  };
}