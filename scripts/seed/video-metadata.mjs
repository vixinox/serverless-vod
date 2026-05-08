import { faker } from "@faker-js/faker";
import { imageBucket, publicS3Base } from "./config.mjs";
import { seededFloat, seededInt } from "./shared.mjs";

const GENERIC_SEED_TITLE_PATTERN = /^Seed video [A-Za-z0-9]{11}$/;

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function readNestedValue(source, path) {
  let cursor = source;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      return null;
    }
    cursor = cursor[key];
  }
  return normalizeText(cursor);
}

function findFirstText(item, paths) {
  for (const path of paths) {
    const value = readNestedValue(item, path);
    if (value) {
      return value;
    }
  }
  return null;
}

function isGenericSeedTitle(value, shortCode) {
  const title = normalizeText(value);
  return !title || title === `Seed video ${shortCode}` || GENERIC_SEED_TITLE_PATTERN.test(title);
}

function hashSeedToInt(shortCode, salt) {
  return seededInt(shortCode, `faker-${salt}`, 1, 999999999);
}

function seededFakerString(shortCode, salt, builder) {
  faker.seed(hashSeedToInt(shortCode, salt));
  return normalizeText(builder()) ?? builder();
}

function buildFallbackDescription(shortCode) {
  return seededFakerString(shortCode, "description", () => {
    const lead = faker.lorem.sentence({ min: 9, max: 14 });
    const detail = faker.lorem.paragraph({ min: 2, max: 3 });
    return `${lead} ${detail}`;
  });
}

function titleFromDescription(description) {
  const firstSentence = normalizeText(description)?.split(/[.!?。！？]/u)[0] ?? "";
  const words = firstSentence
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 7);

  if (words.length < 3) {
    return null;
  }

  return words
    .map((word) => (word.length <= 3 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

function buildFallbackTitle(shortCode) {
  return seededFakerString(shortCode, "title", () => faker.lorem.words({ min: 3, max: 6 }))
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function resolveVideoMetadata(item) {
  const description =
    findFirstText(item, [
      ["hints", "descriptionHint"],
      ["hints", "pexelsDescription"],
      ["hints", "pexels", "description"],
      ["metadata", "description"],
      ["metadata", "pexelsDescription"],
      ["metadata", "pexels", "description"],
      ["pexels", "description"],
      ["source", "description"],
      ["source", "pexelsDescription"],
      ["source", "pexels", "description"],
    ]) ?? buildFallbackDescription(item.shortCode);
  const pexelsTitle = findFirstText(item, [
    ["hints", "pexelsTitle"],
    ["hints", "pexels", "title"],
    ["metadata", "title"],
    ["metadata", "pexelsTitle"],
    ["metadata", "pexels", "title"],
    ["pexels", "title"],
    ["source", "title"],
    ["source", "pexelsTitle"],
    ["source", "pexels", "title"],
  ]);
  const titleHint = item?.hints?.titleHint;
  const title =
    pexelsTitle ??
    (isGenericSeedTitle(titleHint, item.shortCode) ? null : normalizeText(titleHint)) ??
    titleFromDescription(description) ??
    buildFallbackTitle(item.shortCode);

  return {
    title: title.slice(0, 120),
    description,
  };
}

export function buildThumbnailUrl(shortCode) {
  return `${publicS3Base}/${imageBucket}/thumbnails/${shortCode}/thumbnail.jpg`;
}

export function deriveType(item) {
  if (item?.hints?.videoTypeHint === "LONG" || item?.hints?.videoTypeHint === "SHORT") {
    return item.hints.videoTypeHint;
  }
  return seededFloat(item.shortCode, "video-type") < 0.54 ? "SHORT" : "LONG";
}

export function deriveVisibility(item) {
  const score = seededFloat(item.shortCode, "visibility");
  if (score < 0.9) return "PUBLIC";
  if (score < 0.97) return "UNLISTED";
  return "PRIVATE";
}

export function deriveDuration(shortCode, type) {
  if (type === "SHORT") {
    return seededInt(shortCode, "duration-short", 18, 75);
  }
  return seededInt(shortCode, "duration-long", 240, 1600);
}
