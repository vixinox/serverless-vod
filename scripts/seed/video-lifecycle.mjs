import { OWNER_CREATED_AT } from "./config.mjs";
import { addUtcDays, seededFloat, seededInt } from "./shared.mjs";

export function clampTimestampToNow(value) {
  const now = new Date();
  return value.getTime() > now.getTime() ? now : value;
}

export function buildLifecycle(shortCode) {
  const ageBucket = seededFloat(shortCode, "published-age-bucket");
  let publishedDaysAgo;

  if (ageBucket < 0.28) {
    publishedDaysAgo = seededInt(shortCode, "published-age-new", 1, 8);
  } else if (ageBucket < 0.62) {
    publishedDaysAgo = seededInt(shortCode, "published-age-fresh", 9, 28);
  } else if (ageBucket < 0.88) {
    publishedDaysAgo = seededInt(shortCode, "published-age-steady", 29, 75);
  } else {
    publishedDaysAgo = seededInt(shortCode, "published-age-library", 76, 150);
  }

  const publishDay = addUtcDays(new Date(), -publishedDaysAgo);
  const publishAt = new Date(publishDay);
  publishAt.setUTCHours(
    seededInt(shortCode, "publish-hour", 2, 21),
    seededInt(shortCode, "publish-minute", 0, 59),
    0,
    0,
  );

  const readyAt = new Date(
    publishAt.getTime() - seededInt(shortCode, "ready-offset-minutes", 15, 90) * 60 * 1000,
  );
  const startedAt = new Date(
    readyAt.getTime() - seededInt(shortCode, "job-duration-minutes", 5, 16) * 60 * 1000,
  );
  const queuedAt = new Date(
    startedAt.getTime() - seededInt(shortCode, "queue-duration-minutes", 2, 18) * 60 * 1000,
  );
  const createdAt = new Date(
    Math.max(
      OWNER_CREATED_AT.getTime(),
      queuedAt.getTime() - seededInt(shortCode, "created-offset-hours", 3, 28) * 60 * 60 * 1000,
    ),
  );

  return {
    createdAt,
    publishAt,
    publishedAt: publishAt,
    readyAt,
    startedAt,
    queuedAt,
    finishedAt: readyAt,
    publishedDaysAgo,
  };
}
