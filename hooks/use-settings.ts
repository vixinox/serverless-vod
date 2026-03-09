"use client";

import useSWR from "swr";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth-client";
import { getSettings, UserSettingsData } from "@/actions/settings/get-settings";
import { updateSettings } from "@/actions/settings/update-settings";
import { ThemePreference } from "@prisma/client";

const LS_KEY = "user-settings";

function readLocalStorage(): UserSettingsData | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSettingsData;
  } catch {
    return null;
  }
}

function writeLocalStorage(data: UserSettingsData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    // storage quota or privacy mode — silently ignore
  }
}

export function useSettings() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const { setTheme } = useTheme();

  // SWR key is null when logged out — prevents any request
  const { data, mutate } = useSWR<UserSettingsData>(
    userId ? ["settings", userId] : null,
    () => getSettings(),
    {
      fallbackData: readLocalStorage() ?? { theme: ThemePreference.SYSTEM },
      revalidateOnFocus: false,
    }
  );

  // Keep next-themes in sync with the resolved settings
  useEffect(() => {
    if (!data) return;
    const themeMap: Record<ThemePreference, string> = {
      LIGHT: "light",
      DARK: "dark",
      SYSTEM: "system",
    };
    setTheme(themeMap[data.theme]);
    writeLocalStorage(data);
  }, [data, setTheme]);

  /**
   * Call this while the dialog is open.
   * Immediately updates the UI (next-themes + SWR cache + localStorage).
   * Does NOT write to DB.
   */
  function applyLocalTheme(theme: ThemePreference) {
    const next: UserSettingsData = { theme };
    writeLocalStorage(next);
    mutate(next, { revalidate: false });
  }

  /**
   * Call this when the dialog closes.
   * Syncs the current in-memory settings to DB (only if user is logged in).
   */
  async function flushToDB() {
    if (!userId || !data) return;
    await updateSettings({ theme: data.theme });
  }

  return {
    settings: data ?? { theme: ThemePreference.SYSTEM },
    applyLocalTheme,
    flushToDB,
  };
}
