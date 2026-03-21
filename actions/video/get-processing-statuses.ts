"use server";

import { headers } from "next/headers";
import {
  getProcessingStatuses as getProcessingStatusesInternal,
  type ProcessingStatusItem,
} from "@/lib/server/videos";

export type { ProcessingStatusItem } from "@/lib/server/videos";

export async function getProcessingStatuses(
  shortCodes: string[],
): Promise<ProcessingStatusItem[]> {
  return getProcessingStatusesInternal(shortCodes, await headers());
}
