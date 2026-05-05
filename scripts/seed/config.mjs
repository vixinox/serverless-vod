import { join } from "node:path";
import pg from "pg";
import { normalizeInt } from "./shared.mjs";

export const seedRoot = join(process.cwd(), "seed");
export const defaultManifestPath = join(seedRoot, "manifests", "stage1-slices.json");

export const PLAYBACK_WINDOW_DAYS = normalizeInt(process.env.SEED_DB_PLAYBACK_WINDOW_DAYS, 62, 120, 30);
export const DEFAULT_AUDIENCE_USERS = normalizeInt(process.env.SEED_DB_USERS, 120000, 400000, 10000);
export const DEFAULT_DB_POOL_MAX = normalizeInt(process.env.SEED_DB_POOL_MAX, 12, 32, 4);
export const USER_BATCH_SIZE = normalizeInt(process.env.SEED_DB_USER_BATCH_SIZE, 10000, 50000, 1000);
export const SETTINGS_BATCH_SIZE = normalizeInt(process.env.SEED_DB_SETTINGS_BATCH_SIZE, 12000, 50000, 1000);
export const COMMENT_BATCH_SIZE = normalizeInt(process.env.SEED_DB_COMMENT_BATCH_SIZE, 4000, 16000, 500);
export const REACTION_BATCH_SIZE = normalizeInt(process.env.SEED_DB_REACTION_BATCH_SIZE, 5000, 20000, 1000);
export const DAILY_STATS_BATCH_SIZE = normalizeInt(process.env.SEED_DB_DAILY_STATS_BATCH_SIZE, 6000, 24000, 1000);

export const TEST_USER = {
  id: "seed-demo-user",
  name: "Seed Demo Creator",
  email: "seed@test.local",
  password: "12345678",
  channelName: "seed-demo-channel",
  channelDescription: "High-density demo channel used to preview the studio analytics experience.",
};

export const TEST_CHANNEL_ID = "seed-channel-seed-demo-user";
export const TEST_CHANNEL_SUBSCRIBERS = 1286400;
export const OWNER_CREATED_AT = new Date(Date.UTC(2025, 10, 1, 9, 0, 0, 0));

export const AUDIENCE_USER_PREFIX = "seed-audience-";
export const LEGACY_CREATOR_PREFIX = "seed-user-";
export const SEEDED_COMMENT_PREFIX = "seed-comment";

export const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
export const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
export const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
export const publicS3Base = (process.env.LOCALSTACK_PUBLIC_S3_BASE_URL ?? "http://localhost:4566").replace(/\/$/, "");

export const COMMENT_OPENERS = [
  "Strong opening",
  "Really clean edit",
  "Helpful pacing",
  "Thumbnail paid off",
  "Nice hook",
  "Solid structure",
  "Good retention here",
  "Easy to finish",
];

export const COMMENT_FOLLOWUPS = [
  "the first seconds make the topic clear.",
  "the middle section keeps momentum.",
  "the ending lands well.",
  "I can see why this one keeps getting replayed.",
  "this feels polished without dragging.",
  "the watch time makes sense after seeing the flow.",
  "the short format works especially well here.",
  "the longer cut still feels tight.",
];

export function createPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: DEFAULT_DB_POOL_MAX,
  });
}
