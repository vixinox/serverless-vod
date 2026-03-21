import { ThemePreference } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getOptionalUserId, requireUserId } from "@/lib/server/auth-session";

export type UserSettingsData = {
  theme: ThemePreference;
};

const DEFAULT_SETTINGS: UserSettingsData = {
  theme: ThemePreference.SYSTEM,
};

export async function getSettings(requestHeaders?: Headers): Promise<UserSettingsData> {
  const userId = await getOptionalUserId(requestHeaders);

  if (!userId) {
    return DEFAULT_SETTINGS;
  }

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { theme: true },
  });

  return settings ?? DEFAULT_SETTINGS;
}

export async function updateSettings(
  params: { theme: ThemePreference },
  requestHeaders?: Headers,
) {
  const userId = await requireUserId(requestHeaders);

  await prisma.userSettings.upsert({
    where: { userId },
    update: { theme: params.theme },
    create: { userId, theme: params.theme },
  });
}
