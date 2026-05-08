import { OWNER_CREATED_AT } from "./config.mjs";
import { clampTimestampToNow } from "./video-lifecycle.mjs";
import {
  clamp,
  enumerateUtcDays,
  maybeChoice,
  seededFloat,
  seededInt,
  sortBySeed,
} from "./shared.mjs";

const OWNER_LIBRARY_DAYS = enumerateUtcDays(31);

const SYSTEM_PLAYLISTS = [
  {
    key: "WATCH_LATER",
    id: "seed-playlist-watch-later",
    title: "稍后再看",
    description: "系统创建：用于播放器的“稍后再看”快捷保存",
  },
  {
    key: "FAVORITES",
    id: "seed-playlist-favorites",
    title: "收藏夹",
    description: "系统创建：用于播放器的“收藏夹”快捷保存",
  },
];

function pickOwnerLibraryDate(seed, salt, index) {
  const day = maybeChoice(seed, `${salt}-day-${index}`, OWNER_LIBRARY_DAYS);
  const createdAt = new Date(day);
  createdAt.setUTCHours(
    seededInt(seed, `${salt}-hour-${index}`, 0, 23),
    seededInt(seed, `${salt}-minute-${index}`, 0, 59),
    seededInt(seed, `${salt}-second-${index}`, 0, 59),
    0,
  );
  return clampTimestampToNow(createdAt).toISOString();
}

export function buildOwnerPlaylistRows({ owner, videoPlans }) {
  const now = new Date().toISOString();
  const playlistRows = SYSTEM_PLAYLISTS.map((playlist) => ({
    id: playlist.id,
    ownerId: owner.id,
    title: playlist.title,
    description: playlist.description,
    isPublic: false,
    systemKey: playlist.key,
    createdAt: OWNER_LIBRARY_DAYS[0].toISOString(),
    updatedAt: now,
  }));
  const playlistItems = [];
  const rankedVideos = sortBySeed(videoPlans, owner.id, "owner-library-videos");

  for (const playlist of SYSTEM_PLAYLISTS) {
    const ratio = playlist.key === "WATCH_LATER" ? 0.42 : 0.34;
    const count = clamp(Math.round(videoPlans.length * ratio), Math.min(3, videoPlans.length), videoPlans.length);
    const selected = rankedVideos
      .filter((plan, index) => {
        if (playlist.key === "WATCH_LATER") {
          return index % 5 !== 1;
        }
        return index % 5 !== 3;
      })
      .slice(0, count);

    selected.forEach((plan, index) => {
      playlistItems.push({
        id: `seed-playlist-item-${playlist.key.toLowerCase().replace("_", "-")}-${plan.shortCode}`,
        playlistId: playlist.id,
        videoId: plan.videoRow.id,
        addedById: owner.id,
        position: index + 1,
        createdAt: pickOwnerLibraryDate(owner.id, `${playlist.key}-${plan.shortCode}`, index),
      });
    });
  }

  return {
    playlistRows,
    playlistItemRows: playlistItems,
  };
}

export function buildOwnerPlaybackEventRows({ owner, videoPlans }) {
  const rankedVideos = sortBySeed(videoPlans, owner.id, "owner-history-videos");
  const count = clamp(Math.round(videoPlans.length * 0.72), Math.min(6, videoPlans.length), videoPlans.length);
  const selected = rankedVideos.slice(0, count);
  const rows = [];

  selected.forEach((plan, index) => {
    const eventCount = seededInt(plan.shortCode, "owner-history-event-count", 1, 3);
    for (let eventIndex = 0; eventIndex < eventCount; eventIndex += 1) {
      const createdAt = pickOwnerLibraryDate(owner.id, `history-${plan.shortCode}-${eventIndex}`, index + eventIndex);
      const duration = plan.videoRow.duration ?? 60;
      const watchedSeconds = clamp(
        seededInt(plan.shortCode, `owner-history-watch-${eventIndex}`, Math.min(8, duration), duration),
        1,
        duration,
      );

      rows.push({
        id: `seed-playback-${plan.shortCode}-${eventIndex + 1}`,
        videoId: plan.videoRow.id,
        userId: owner.id,
        sessionId: `seed-session-${owner.id}-${plan.shortCode}-${eventIndex + 1}`,
        eventType: "PLAY_START",
        positionSeconds: 0,
        durationSeconds: duration,
        watchDeltaMs: watchedSeconds * 1000,
        playbackRate: "1.00",
        isMuted: seededFloat(plan.shortCode, `owner-history-muted-${eventIndex}`) < 0.16,
        volume: seededInt(plan.shortCode, `owner-history-volume-${eventIndex}`, 35, 100),
        qualityLabel: plan.videoRow.type === "SHORT" ? "source" : maybeChoice(plan.shortCode, `owner-history-quality-${eventIndex}`, ["720p", "1080p"]),
        source: "seed-history",
        referrer: "/",
        userAgent: "SeedBrowser/1.0",
        ipHash: `seed-ip-${seededInt(plan.shortCode, `owner-history-ip-${eventIndex}`, 1000, 9999)}`,
        countryCode: "US",
        createdAt,
      });
    }
  });

  return rows.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
}

export { OWNER_CREATED_AT };
