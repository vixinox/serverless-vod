import {
  AUDIENCE_USER_PREFIX,
  DEFAULT_AUDIENCE_USERS,
  TEST_CHANNEL_ID,
  TEST_USER,
} from "./config.mjs";
import { seededInt } from "./shared.mjs";

const NAME_PREFIXES = [
  "Mango",
  "Nova",
  "Pixel",
  "Orbit",
  "Cedar",
  "Echo",
  "Comet",
  "Willow",
  "River",
  "Solar",
  "Tidal",
  "Panda",
];

const NAME_SUFFIXES = [
  "Viewer",
  "Clip",
  "Frame",
  "Wave",
  "Pulse",
  "Spark",
  "Lens",
  "Cloud",
  "Echo",
  "Scene",
  "Trail",
  "Drift",
];

function themeFromSeed(seed) {
  const value = seededInt(seed, "theme", 0, 2);
  if (value === 0) return "LIGHT";
  if (value === 1) return "DARK";
  return "SYSTEM";
}

function buildAudienceName(index) {
  const seed = `audience-name-${index + 1}`;
  return `${NAME_PREFIXES[seededInt(seed, "prefix", 0, NAME_PREFIXES.length - 1)]} ${NAME_SUFFIXES[seededInt(seed, "suffix", 0, NAME_SUFFIXES.length - 1)]} ${String(index + 1).padStart(6, "0")}`;
}

function buildAudienceUser(index) {
  const sequence = index + 1;
  const value = String(sequence).padStart(6, "0");
  const id = `${AUDIENCE_USER_PREFIX}${value}`;
  const createdAt = new Date(Date.UTC(2025, 0, 1, 0, 0, 0, 0) + sequence * 90 * 1000);

  return {
    id,
    name: buildAudienceName(index),
    email: `audience.${value}@seed.local`,
    theme: themeFromSeed(id),
    createdAt: createdAt.toISOString(),
  };
}

export function buildSeedActors(audienceCount = DEFAULT_AUDIENCE_USERS) {
  const audience = Array.from({ length: audienceCount }, (_, index) => buildAudienceUser(index));

  return {
    owner: {
      ...TEST_USER,
      channelId: TEST_CHANNEL_ID,
    },
    audience,
  };
}
