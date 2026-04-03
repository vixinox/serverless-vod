export const WATCH_LATER_PLAYLIST_KEY = "WATCH_LATER" as const;
export const FAVORITES_PLAYLIST_KEY = "FAVORITES" as const;

export type SystemPlaylistKey =
  | typeof WATCH_LATER_PLAYLIST_KEY
  | typeof FAVORITES_PLAYLIST_KEY;

export const SYSTEM_PLAYLIST_META: Record<
  SystemPlaylistKey,
  { title: string; description: string }
> = {
  WATCH_LATER: {
    title: "稍后再看",
    description: "系统创建：用于播放器的“稍后再看”快捷保存",
  },
  FAVORITES: {
    title: "收藏夹",
    description: "系统创建：用于播放器的“收藏夹”快捷保存",
  },
};

export const WATCH_LATER_PLAYLIST_TITLE =
  SYSTEM_PLAYLIST_META[WATCH_LATER_PLAYLIST_KEY].title;
export const WATCH_LATER_PLAYLIST_DESCRIPTION =
  SYSTEM_PLAYLIST_META[WATCH_LATER_PLAYLIST_KEY].description;
export const FAVORITES_PLAYLIST_TITLE =
  SYSTEM_PLAYLIST_META[FAVORITES_PLAYLIST_KEY].title;
export const FAVORITES_PLAYLIST_DESCRIPTION =
  SYSTEM_PLAYLIST_META[FAVORITES_PLAYLIST_KEY].description;

export const WATCH_LATER_LEGACY_MATCH = {
  title: WATCH_LATER_PLAYLIST_TITLE,
  description: "系统创建：用于播放器“添加到”快捷保存",
  isPublic: false,
} as const;

export const QUICK_SAVE_PLAYLIST_TITLE = WATCH_LATER_PLAYLIST_TITLE;
export const QUICK_SAVE_PLAYLIST_DESCRIPTION = WATCH_LATER_PLAYLIST_DESCRIPTION;

export function getSystemPlaylistMeta(key: SystemPlaylistKey) {
  return SYSTEM_PLAYLIST_META[key];
}

export function isSystemPlaylistKey(value: unknown): value is SystemPlaylistKey {
  return value === WATCH_LATER_PLAYLIST_KEY || value === FAVORITES_PLAYLIST_KEY;
}
