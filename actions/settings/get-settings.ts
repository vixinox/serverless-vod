'use server'

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { headers } from "next/headers";
import { ThemePreference } from "@prisma/client";

export type UserSettingsData = {
  theme: ThemePreference;
};

const DEFAULT_SETTINGS: UserSettingsData = {
  theme: ThemePreference.SYSTEM,
};

export async function getSettings(): Promise<UserSettingsData> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return DEFAULT_SETTINGS;

  const settings = await prisma.userSettings.findUnique({
    where: { userId: session.user.id },
    select: { theme: true },
  });

  return settings ?? DEFAULT_SETTINGS;
}
