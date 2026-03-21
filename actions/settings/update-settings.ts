'use server';

import { ThemePreference } from "@prisma/client";
import * as z from "zod";
import { headers } from "next/headers";
import { updateSettings as updateSettingsMutation } from "@/lib/server/settings";

const updateSettingsSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"] as const),
});

export async function updateSettings(params: { theme: ThemePreference }) {
  const parsed = updateSettingsSchema.safeParse(params);

  if (!parsed.success) {
    throw new Error(`输入数据不合法: ${parsed.error.message}`);
  }

  await updateSettingsMutation(parsed.data, await headers());
}
