"use client";

import useSWR from "swr";
import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { authClient } from "@/lib/auth-client";
import { ThemePreference } from "@prisma/client";
import { apiRequest } from "@/lib/api-client";
import type { UserSettingsData } from "@/lib/server/settings";

const LS_KEY = "user-settings";

function readLocalStorage(): UserSettingsData | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserSettingsData;
  } catch {
    return null;
  }
}

function writeLocalStorage(data: UserSettingsData) {
  if (typeof window === "undefined") {
    return;
  }

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
  const inflightThemeRef = useRef<ThemePreference | null>(null);

  // SWR key is null when logged out — prevents any request
  const { data, mutate } = useSWR<UserSettingsData>(
    userId ? ["settings", userId] : null,
    () => apiRequest<UserSettingsData>("/api/settings"),
    {
      fallbackData: readLocalStorage() ?? { theme: ThemePreference.SYSTEM },
      revalidateOnFocus: false,
    }
  );

  // Keep the client theme in sync with the resolved settings.
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
   * Immediately updates the UI (theme provider + SWR cache + localStorage).
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
    if (inflightThemeRef.current === data.theme) return;

    inflightThemeRef.current = data.theme;

    try {
      await apiRequest<{ success: true }>("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ theme: data.theme }),
      });
    } finally {
      inflightThemeRef.current = null;
    }
  }

  return {
    settings: data ?? { theme: ThemePreference.SYSTEM },
    applyLocalTheme,
    flushToDB,
  };
}
