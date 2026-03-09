'use server'

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { ThemePreference } from "@prisma/client";
import * as z from "zod";

const updateSettingsSchema = z.object({
  theme: z.enum(["LIGHT", "DARK", "SYSTEM"] as const),
});

export async function updateSettings(params: { theme: ThemePreference }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) throw new Error("未登录");

  const parsed = updateSettingsSchema.safeParse(params);
  if (!parsed.success) throw new Error(`输入数据不合法: ${parsed.error.message}`);

  await prisma.userSettings.upsert({
    where: { userId: session.user.id },
    update: { theme: parsed.data.theme },
    create: { userId: session.user.id, theme: parsed.data.theme },
  });
}
