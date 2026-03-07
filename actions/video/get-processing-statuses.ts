"use server";

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type ProcessingStatusItem = {
  shortCode: string;
  processingStatus: string;
  pipelineStage: string | null;
  jobStatus: string | null;
  jobError: string | null;
};

export async function getProcessingStatuses(
  shortCodes: string[]
): Promise<ProcessingStatusItem[]> {
  if (shortCodes.length === 0) return [];

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/login");

  const videos = await prisma.video.findMany({
    where: {
      shortCode: { in: shortCodes },
      userId: session.user.id,
    },
    select: {
      shortCode: true,
      processingStatus: true,
      transcodeJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          status: true,
          pipelineStage: true,
          lastError: true,
        },
      },
    },
  });

  return videos.map((v) => {
    const job = v.transcodeJobs[0] ?? null;
    return {
      shortCode: v.shortCode,
      processingStatus: v.processingStatus,
      pipelineStage: job?.pipelineStage ?? null,
      jobStatus: job?.status ?? null,
      jobError: job?.lastError ?? null,
    };
  });
}
