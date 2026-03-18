'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function getHistoryVideos(limit: number = 24) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/history");
  }

  const rows = await prisma.$queryRaw<{
    id: string;
    shortCode: string;
    title: string;
    description: string | null;
    views: bigint;
    thumbnail: string | null;
    type: "LONG" | "SHORT";
    createdAt: Date;
    ownerName: string;
    ownerImage: string | null;
    lastWatchedAt: Date;
  }[]>`
    SELECT *
    FROM (
      SELECT DISTINCT ON (vpe."videoId")
        v."id",
        v."shortCode",
        v."title",
        v."description",
        v."views",
        v."thumbnail",
        v."type",
        v."createdAt",
        u."name" AS "ownerName",
        u."image" AS "ownerImage",
        vpe."createdAt" AS "lastWatchedAt"
      FROM "VideoPlaybackEvent" vpe
      INNER JOIN "Video" v ON v."id" = vpe."videoId"
      INNER JOIN "user" u ON u."id" = v."userId"
      WHERE
        vpe."userId" = ${session.user.id}
        AND v."deletedAt" IS NULL
        AND (
          v."userId" = ${session.user.id}
          OR (
            v."visibility" IN ('PUBLIC', 'UNLISTED')
            AND v."processingStatus" = 'READY'
          )
        )
      ORDER BY vpe."videoId", vpe."createdAt" DESC
    ) AS history
    ORDER BY history."lastWatchedAt" DESC
    LIMIT ${Math.min(Math.max(limit, 1), 48)}
  `;

  return rows.map((row) => ({
    id: row.id,
    shortCode: row.shortCode,
    title: row.title,
    description: row.description ?? "",
    views: Number(row.views),
    thumbnail: row.thumbnail ?? "",
    type: row.type,
    createdAt: row.createdAt,
    ownerName: row.ownerName,
    ownerImage: row.ownerImage ?? "",
    lastWatchedAt: row.lastWatchedAt,
  }));
}
