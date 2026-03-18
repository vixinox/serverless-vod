'use server'
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function getRecommendation(limit: number = 20, excludeShortCodes: string[] = []) {
  const excludeClause = excludeShortCodes.length > 0
    ? Prisma.sql`AND v."shortCode" NOT IN (${Prisma.join(excludeShortCodes)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{
    id: string;
    shortCode: string;
    title: string;
    views: bigint;
    thumbnail: string | null;
    createdAt: Date;
    ownerName: string;
  }[]>`
    SELECT
      v."id",
      v."shortCode",
      v."title",
      v."views",
      v."thumbnail",
      v."createdAt",
      u."name" AS "ownerName"
    FROM "Video" v
    INNER JOIN "user" u ON u."id" = v."userId"
    WHERE
      v."deletedAt" IS NULL
      AND v."visibility" = 'PUBLIC'::"Visibility"
      AND v."processingStatus" = 'READY'::"VideoProcessingStatus"
      ${excludeClause}
    ORDER BY RANDOM()
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    views: Number(row.views),
  }));
}

export type VideoData = Awaited<ReturnType<typeof getRecommendation>>[number];
