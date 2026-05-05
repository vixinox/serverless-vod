import { faker } from "@faker-js/faker";
import {
  COMMENT_FOLLOWUPS,
  COMMENT_OPENERS,
  OWNER_CREATED_AT,
  PLAYBACK_WINDOW_DAYS,
  SEEDED_COMMENT_PREFIX,
  TEST_CHANNEL_SUBSCRIBERS,
  hlsBucket,
  imageBucket,
  publicS3Base,
  rawBucket,
} from "./config.mjs";
import {
  addUtcDays,
  clamp,
  daysBetweenUtc,
  distributeIntegers,
  enumerateUtcDays,
  maybeChoice,
  pickSeededSubset,
  seededFloat,
  seededInt,
  sortBySeed,
  startOfUtcDay,
  sum,
  toDateKey,
} from "./shared.mjs";

const VIDEO_DAYS = enumerateUtcDays(PLAYBACK_WINDOW_DAYS);
const OWNER_LIBRARY_DAYS = enumerateUtcDays(31);
const GENERIC_SEED_TITLE_PATTERN = /^Seed video [A-Za-z0-9]{11}$/;
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

function clampTimestampToNow(value) {
  const now = new Date();
  return value.getTime() > now.getTime() ? now : value;
}

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

function seededFakerString(shortCode, salt, builder) {
  faker.seed(hashSeedToInt(shortCode, salt));
  return normalizeText(builder()) ?? builder();
}

function hashSeedToInt(shortCode, salt) {
  return seededInt(shortCode, `faker-${salt}`, 1, 999999999);
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

function resolveVideoMetadata(item) {
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

function buildThumbnailUrl(shortCode) {
  return `${publicS3Base}/${imageBucket}/thumbnails/${shortCode}/thumbnail.jpg`;
}

function buildLifecycle(shortCode) {
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

function deriveType(item) {
  if (item?.hints?.videoTypeHint === "LONG" || item?.hints?.videoTypeHint === "SHORT") {
    return item.hints.videoTypeHint;
  }
  return seededFloat(item.shortCode, "video-type") < 0.54 ? "SHORT" : "LONG";
}

function deriveVisibility(item) {
  const score = seededFloat(item.shortCode, "visibility");
  if (score < 0.9) return "PUBLIC";
  if (score < 0.97) return "UNLISTED";
  return "PRIVATE";
}

function deriveDuration(shortCode, type) {
  if (type === "SHORT") {
    return seededInt(shortCode, "duration-short", 18, 75);
  }
  return seededInt(shortCode, "duration-long", 240, 1600);
}

function resolveViewTier(index) {
  const tierSlot = index % 6;
  if (tierSlot < 3) {
    return { key: "TEN_THOUSANDS", totalMin: 10000, totalMax: 99999 };
  }
  if (tierSlot < 5) {
    return { key: "HUNDRED_THOUSANDS", totalMin: 100000, totalMax: 999999 };
  }

  const millionSlot = Math.floor(index / 6) % 6;
  if (millionSlot === 0 || millionSlot === 1 || millionSlot === 4) {
    return { key: "MILLION_LOW", totalMin: 1000000, totalMax: 1999999 };
  }
  if (millionSlot === 2 || millionSlot === 5) {
    return { key: "MILLION_MID", totalMin: 2000000, totalMax: 2999999 };
  }
  return { key: "MILLION_HIGH", totalMin: 3000000, totalMax: 4999999 };
}

function buildDailyStatsPlan({ shortCode, type, duration, publishedAt, totalViews, tier }) {
  const publishedDay = startOfUtcDay(publishedAt);
  const publishedDaysAgo = Math.max(1, daysBetweenUtc(new Date(), publishedDay));
  const recentShareBase =
    publishedDaysAgo <= 7
      ? 0.7
      : publishedDaysAgo <= 30
        ? 0.48
        : publishedDaysAgo <= 75
          ? 0.28
          : 0.15;
  const recentShare = clamp(
    recentShareBase + seededFloat(shortCode, "recent-share") * 0.18,
    0.12,
    0.88,
  );
  const recentViews = Math.max(
    1,
    Math.min(totalViews - Math.min(5000, totalViews - 1), Math.round(totalViews * recentShare)),
  );

  const weights = VIDEO_DAYS.map((date, index) => {
    if (date.getTime() < publishedDay.getTime()) {
      return 0;
    }

    const daysSincePublish = Math.max(0, daysBetweenUtc(date, publishedDay));
    const launchCurve = 1.2 + Math.exp(-Math.abs(daysSincePublish - 2) / 3.2);
    const spikeOne = 1 + Math.exp(-((index - seededInt(shortCode, "spike-one-day", 4, 18)) ** 2) / 14);
    const spikeTwoCenter = seededInt(shortCode, "spike-two-day", 11, 28);
    const spikeTwo =
      seededFloat(shortCode, "spike-two-enabled") < 0.7
        ? 1 + 0.85 * Math.exp(-((index - spikeTwoCenter) ** 2) / 20)
        : 1;
    const weekdayWeights = [0.92, 0.97, 1.01, 1.05, 1.1, 1.17, 1.13];
    const weekdayWeight = weekdayWeights[date.getUTCDay()];
    const freshnessBoost = publishedDaysAgo <= 30 ? 1.14 : publishedDaysAgo <= 75 ? 1 : 0.9;
    const typeBias = type === "SHORT" ? 1.22 : 0.94;
    const noise = 0.76 + seededFloat(shortCode, `weight-noise-${toDateKey(date)}`) * 0.65;
    return launchCurve * spikeOne * spikeTwo * weekdayWeight * freshnessBoost * typeBias * noise;
  });

  const dailyViews = distributeIntegers(recentViews, weights);
  const likeRate =
    type === "SHORT"
      ? 0.013 + seededFloat(shortCode, "like-rate") * 0.018
      : 0.011 + seededFloat(shortCode, "like-rate") * 0.016;
  const recentLikes = clamp(
    Math.round(recentViews * likeRate),
    500,
    Math.max(500, Math.round(recentViews * 0.05)),
  );
  const recentDislikes = clamp(
    Math.round(recentLikes * (0.012 + seededFloat(shortCode, "dislike-rate") * 0.03)),
    10,
    Math.max(10, Math.round(recentLikes * 0.08)),
  );
  const likeDaily = distributeIntegers(
    recentLikes,
    weights.map((weight, index) => weight + (index % 5 === 0 ? 0.2 : 0)),
  );
  const dislikeDaily = distributeIntegers(
    recentDislikes,
    weights.map((weight, index) => weight + (index % 7 === 0 ? 0.15 : 0)),
  );

  const dailyRows = [];
  for (let index = 0; index < VIDEO_DAYS.length; index += 1) {
    const date = VIDEO_DAYS[index];
    const views = dailyViews[index];
    if (date.getTime() < publishedDay.getTime() || views <= 0) {
      dailyRows.push({
        date,
        views: 0,
        uniqueViewers: 0,
        watchTimeSeconds: 0,
        likesGained: 0,
        dislikesGained: 0,
      });
      continue;
    }
    const uniqueRatio =
      type === "SHORT"
        ? 0.62 + seededFloat(shortCode, `unique-short-${index}`) * 0.18
        : 0.54 + seededFloat(shortCode, `unique-long-${index}`) * 0.17;
    const uniqueViewers = clamp(Math.round(views * uniqueRatio), 0, views);
    const avgRetention =
      type === "SHORT"
        ? 0.72 + seededFloat(shortCode, `retention-short-${index}`) * 0.18
        : 0.31 + seededFloat(shortCode, `retention-long-${index}`) * 0.24;
    const averageWatchSeconds = clamp(
      Math.round(duration * avgRetention),
      Math.min(duration, type === "SHORT" ? 12 : 45),
      duration,
    );

    dailyRows.push({
      date,
      views,
      uniqueViewers,
      watchTimeSeconds: views * averageWatchSeconds,
      likesGained: likeDaily[index] ?? 0,
      dislikesGained: dislikeDaily[index] ?? 0,
    });
  }

  const legacyLikesFactor =
    publishedDaysAgo <= 30
      ? 0.3 + seededFloat(shortCode, "legacy-likes-new") * 0.5
      : 0.7 + seededFloat(shortCode, "legacy-likes-old") * 1.2;
  const legacyDislikesFactor = 0.35 + seededFloat(shortCode, "legacy-dislikes") * 0.9;

  return {
    tier,
    totalLikes: recentLikes + Math.round(recentLikes * legacyLikesFactor),
    totalDislikes: recentDislikes + Math.round(recentDislikes * legacyDislikesFactor),
    dailyRows,
  };
}

function buildShortCommentSentence(shortCode, index, mode = "comment") {
  const opener = maybeChoice(shortCode, `comment-opener-${mode}-${index}`, COMMENT_OPENERS);
  const followup = maybeChoice(shortCode, `comment-followup-${mode}-${index}`, COMMENT_FOLLOWUPS);
  return `${opener}, ${followup}`;
}

function buildLongCommentSentence(shortCode, index, mode = "comment") {
  const opener = buildShortCommentSentence(shortCode, index, mode);
  const details = [
    "Retention looks healthy all the way through.",
    "This feels like a clip people would share in group chats.",
    "The topic lands quickly and keeps moving.",
    "I ended up watching the whole thing without noticing.",
    "The pacing makes the replay value believable.",
    "The comment section is going to stay busy on this one.",
    "This kind of packaging usually performs well for a reason.",
    "There is almost no dead air here.",
  ];
  const secondDetails = [
    "The framing makes the main point easy to understand without needing extra context.",
    "I like that the edit gives the subject enough room while still moving at a useful pace.",
    "This is the kind of upload that makes the analytics curve feel believable instead of random.",
    "The moment-to-moment rhythm explains why people would come back and replay sections.",
  ];
  return `${opener} ${maybeChoice(shortCode, `comment-detail-${mode}-${index}`, details)} ${maybeChoice(
    shortCode,
    `comment-extra-${mode}-${index}`,
    secondDetails,
  )}`;
}

function buildCommentSentence(shortCode, index, mode = "comment") {
  const isParent = mode === "parent";
  const shouldUseLong = isParent ? index % 2 === 0 : index % 3 === 0;
  return shouldUseLong
    ? buildLongCommentSentence(shortCode, index, mode)
    : buildShortCommentSentence(shortCode, index, mode);
}

function getHotLikeRange(tierKey) {
  switch (tierKey) {
    case "TEN_THOUSANDS":
      return [18, 90];
    case "HUNDRED_THOUSANDS":
      return [60, 240];
    case "MILLION_LOW":
    case "MILLION_MID":
      return [180, 750];
    default:
      return [650, 1800];
  }
}

function getMidLikeRange(tierKey) {
  switch (tierKey) {
    case "TEN_THOUSANDS":
      return [3, 18];
    case "HUNDRED_THOUSANDS":
      return [10, 60];
    case "MILLION_LOW":
    case "MILLION_MID":
      return [20, 140];
    default:
      return [40, 240];
  }
}

function getReplyLikeRange(tierKey) {
  switch (tierKey) {
    case "TEN_THOUSANDS":
      return [0, 6];
    case "HUNDRED_THOUSANDS":
      return [0, 14];
    case "MILLION_LOW":
    case "MILLION_MID":
      return [0, 28];
    default:
      return [0, 45];
  }
}

function pickReactionTimestamp(baseDate, seed, salt) {
  return clampTimestampToNow(new Date(
    baseDate.getTime() + seededInt(seed, `${salt}:minutes`, 6, 24 * 60 * 3) * 60 * 1000,
  ));
}

function buildCommentPlan({ shortCode, videoId, audienceUsers, dailyRows, tierKey }) {
  const totalComments = seededInt(shortCode, "total-comments", 50, 100);
  const parentCount = Math.min(totalComments - 1, seededInt(shortCode, "parent-comments", 12, 24));
  const replyCount = totalComments - parentCount;
  const hotParentCount = Math.min(parentCount, seededInt(shortCode, "hot-parent-count", 3, 5));
  const commentAuthors = pickSeededSubset(audienceUsers, shortCode, "comment-authors", totalComments);
  const dayWeights = dailyRows.map((row, index) => row.views + 1 + (index % 6 === 0 ? 25 : 0));
  const parentDistribution = distributeIntegers(parentCount, dayWeights);
  const parentRows = [];
  const replyRows = [];
  const reactionRows = [];
  const parentReplyCounts = new Map();
  const commentDailyMap = new Map(dailyRows.map((row) => [toDateKey(row.date), 0]));

  let parentCursor = 0;
  for (let dayIndex = 0; dayIndex < dailyRows.length; dayIndex += 1) {
    const count = parentDistribution[dayIndex];
    for (let index = 0; index < count; index += 1) {
      const id = `${SEEDED_COMMENT_PREFIX}-${shortCode}-p-${String(parentCursor + 1).padStart(4, "0")}`;
      const createdAt = new Date(dailyRows[dayIndex].date);
      createdAt.setUTCHours(
        seededInt(shortCode, `parent-hour-${parentCursor}`, 1, 22),
        seededInt(shortCode, `parent-minute-${parentCursor}`, 0, 59),
        seededInt(shortCode, `parent-second-${parentCursor}`, 0, 59),
        0,
      );

      const safeCreatedAt = clampTimestampToNow(createdAt);

      parentRows.push({
        id,
        content: buildCommentSentence(shortCode, parentCursor, "parent"),
        userId: commentAuthors[parentCursor % commentAuthors.length].id,
        videoId,
        parentId: null,
        repliesCount: 0,
        likesCount: 0,
        dislikesCount: 0,
        createdAt: safeCreatedAt,
        updatedAt: safeCreatedAt,
        deletedAt: null,
      });
      const key = toDateKey(safeCreatedAt);
      commentDailyMap.set(key, (commentDailyMap.get(key) ?? 0) + 1);
      parentCursor += 1;
    }
  }

  const rankedParents = sortBySeed(parentRows, shortCode, "ranked-parents");
  const replyWeights = rankedParents.map((_, index) => {
    if (index < hotParentCount) {
      return hotParentCount - index + 7;
    }
    return index < Math.ceil(parentRows.length * 0.55) ? 2 : 1;
  });
  const repliesPerParent = distributeIntegers(replyCount, replyWeights);

  let replyCursor = 0;
  for (let parentIndex = 0; parentIndex < rankedParents.length; parentIndex += 1) {
    const parent = rankedParents[parentIndex];
    const count = repliesPerParent[parentIndex] ?? 0;
    parentReplyCounts.set(parent.id, count);

    for (let index = 0; index < count; index += 1) {
      const id = `${SEEDED_COMMENT_PREFIX}-${shortCode}-r-${String(replyCursor + 1).padStart(4, "0")}`;
      const createdAt = clampTimestampToNow(new Date(
        parent.createdAt.getTime() + seededInt(shortCode, `reply-offset-${replyCursor}`, 5, 60 * 36) * 60 * 1000,
      ));
      const author = commentAuthors[(parentRows.length + replyCursor) % commentAuthors.length];

      replyRows.push({
        id,
        content: buildCommentSentence(shortCode, replyCursor, "reply"),
        userId: author.id,
        videoId,
        parentId: parent.id,
        repliesCount: 0,
        likesCount: 0,
        dislikesCount: 0,
        createdAt,
        updatedAt: createdAt,
        deletedAt: null,
      });
      const key = toDateKey(createdAt);
      commentDailyMap.set(key, (commentDailyMap.get(key) ?? 0) + 1);
      replyCursor += 1;
    }
  }

  const hotRange = getHotLikeRange(tierKey);
  const midRange = getMidLikeRange(tierKey);
  const replyRange = getReplyLikeRange(tierKey);

  for (let index = 0; index < rankedParents.length; index += 1) {
    const parent = rankedParents[index];
    if (index < hotParentCount) {
      parent.likesCount = seededInt(shortCode, `hot-parent-likes-${index}`, hotRange[0], hotRange[1]);
    } else if (index < Math.ceil(rankedParents.length * 0.55)) {
      parent.likesCount = seededInt(shortCode, `mid-parent-likes-${index}`, midRange[0], midRange[1]);
    } else {
      parent.likesCount = seededInt(
        shortCode,
        `tail-parent-likes-${index}`,
        0,
        Math.max(4, Math.floor(midRange[1] * 0.08)),
      );
    }
    parent.repliesCount = parentReplyCounts.get(parent.id) ?? 0;
  }

  for (let index = 0; index < replyRows.length; index += 1) {
    const row = replyRows[index];
    if (index < Math.ceil(replyRows.length * 0.2)) {
      row.likesCount = seededInt(
        shortCode,
        `reply-likes-boost-${index}`,
        Math.max(2, Math.floor(replyRange[1] * 0.25)),
        replyRange[1],
      );
    } else {
      row.likesCount = seededInt(
        shortCode,
        `reply-likes-${index}`,
        replyRange[0],
        Math.max(replyRange[0], Math.floor(replyRange[1] * 0.45)),
      );
    }
  }

  for (const row of [...parentRows, ...replyRows]) {
    if (row.likesCount <= 0) {
      continue;
    }

    const reactionUsers = pickSeededSubset(
      audienceUsers,
      shortCode,
      `comment-reactions-${row.id}`,
      row.likesCount,
    );

    for (let index = 0; index < row.likesCount; index += 1) {
      reactionRows.push({
        userId: reactionUsers[index].id,
        commentId: row.id,
        reactionType: "LIKE",
        createdAt: pickReactionTimestamp(row.createdAt, shortCode, `${row.id}:${index}`),
      });
    }
  }

  const dailyComments = new Map();
  for (const row of dailyRows) {
    dailyComments.set(toDateKey(row.date), commentDailyMap.get(toDateKey(row.date)) ?? 0);
  }

  return {
    totalComments,
    parentRows,
    replyRows,
    reactionRows,
    dailyComments,
  };
}

function buildSeedVideoId(shortCode) {
  return `seed-video-${shortCode}`;
}

function buildSeedVideoAssetId(shortCode, kind) {
  return `seed-asset-${shortCode}-${kind}`;
}

function buildSeedTranscodeJobId(shortCode) {
  return `seed-job-${shortCode}`;
}

function buildSeedUploadSessionId(shortCode) {
  return `seed-upload-${shortCode}`;
}

function buildVideoSeedPlan({ item, itemIndex, owner, audienceUsers }) {
  const type = deriveType(item);
  const visibility = deriveVisibility(item);
  const duration = deriveDuration(item.shortCode, type);
  const lifecycle = buildLifecycle(item.shortCode);
  const tier = resolveViewTier(itemIndex);
  const totalViews = seededInt(item.shortCode, `total-views-${tier.key}`, tier.totalMin, tier.totalMax);
  const metadata = resolveVideoMetadata(item);
  const videoId = buildSeedVideoId(item.shortCode);
  const now = new Date();

  const analytics = buildDailyStatsPlan({
    shortCode: item.shortCode,
    type,
    duration,
    publishedAt: lifecycle.publishedAt,
    totalViews,
    tier,
  });
  const comments = buildCommentPlan({
    shortCode: item.shortCode,
    videoId,
    audienceUsers,
    dailyRows: analytics.dailyRows,
    tierKey: analytics.tier.key,
  });

  const videoDailyRows = analytics.dailyRows.map((row) => ({
    id: `seed-vds-${item.shortCode}-${toDateKey(row.date)}`,
    videoId,
    date: toDateKey(row.date),
    views: row.views,
    uniqueViewers: row.uniqueViewers,
    watchTimeSeconds: row.watchTimeSeconds,
    likesGained: row.likesGained,
    dislikesGained: row.dislikesGained,
    commentsGained: comments.dailyComments.get(toDateKey(row.date)) ?? 0,
  }));

  return {
    id: videoId,
    shortCode: item.shortCode,
    publishedAt: lifecycle.publishedAt,
    videoRow: {
      id: videoId,
      title: metadata.title,
      description: metadata.description,
      shortCode: item.shortCode,
      thumbnail: buildThumbnailUrl(item.shortCode),
      duration,
      type,
      visibility,
      processingStatus: "READY",
      publishAt: lifecycle.publishAt.toISOString(),
      publishedAt: lifecycle.publishedAt.toISOString(),
      readyAt: lifecycle.readyAt.toISOString(),
      processingError: null,
      userId: owner.id,
      channelId: owner.channelId,
      views: totalViews,
      likesCount: analytics.totalLikes,
      dislikesCount: analytics.totalDislikes,
      commentsCount: comments.totalComments,
      deletedAt: null,
      createdAt: lifecycle.createdAt.toISOString(),
      updatedAt: now.toISOString(),
    },
    videoAssetRows: [
      {
        id: buildSeedVideoAssetId(item.shortCode, "hls"),
        videoId,
        assetType: "HLS_MASTER",
        qualityLabel: type === "SHORT" ? "source" : "1080p",
        mimeType: "application/vnd.apple.mpegurl",
        storageBucket: hlsBucket,
        storageKey: `${item.shortCode}/master.m3u8`,
        isPrimary: true,
        createdAt: lifecycle.readyAt.toISOString(),
        updatedAt: lifecycle.readyAt.toISOString(),
      },
      {
        id: buildSeedVideoAssetId(item.shortCode, "thumbnail"),
        videoId,
        assetType: "THUMBNAIL",
        qualityLabel: "cover",
        mimeType: "image/jpeg",
        storageBucket: imageBucket,
        storageKey: `thumbnails/${item.shortCode}/thumbnail.jpg`,
        isPrimary: true,
        createdAt: lifecycle.readyAt.toISOString(),
        updatedAt: lifecycle.readyAt.toISOString(),
      },
    ],
    transcodeJobRow: {
      id: buildSeedTranscodeJobId(item.shortCode),
      videoId,
      provider: "LOCALSTACK",
      queueMessageId: null,
      inputBucket: rawBucket,
      inputKey: `${item.shortCode}/source.mp4`,
      outputBucket: hlsBucket,
      outputPrefix: item.shortCode,
      status: "SUCCEEDED",
      attempt: 1,
      maxAttempts: 3,
      pipelineStage: "thumbnail_uploading",
      lastError: null,
      queuedAt: lifecycle.queuedAt.toISOString(),
      startedAt: lifecycle.startedAt.toISOString(),
      finishedAt: lifecycle.finishedAt.toISOString(),
      createdAt: lifecycle.queuedAt.toISOString(),
      updatedAt: lifecycle.finishedAt.toISOString(),
    },
    uploadSessionRow: {
      id: buildSeedUploadSessionId(item.shortCode),
      videoId,
      uploaderId: owner.id,
      storageBucket: rawBucket,
      objectKey: `${item.shortCode}/source.mp4`,
      multipartUploadId: null,
      partCount: seededInt(item.shortCode, "part-count", 5, 18),
      status: "COMPLETED",
      expiresAt: lifecycle.queuedAt.toISOString(),
      completedAt: lifecycle.startedAt.toISOString(),
      abortedAt: null,
      createdAt: new Date(lifecycle.queuedAt.getTime() - 90 * 60 * 1000).toISOString(),
      updatedAt: lifecycle.startedAt.toISOString(),
    },
    commentRows: [...comments.parentRows, ...comments.replyRows].map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    commentReactionRows: comments.reactionRows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    videoDailyRows,
    summary: {
      shortCode: item.shortCode,
      type,
      visibility,
      totalViews,
      tierKey: tier.key,
      recentViews: sum(videoDailyRows.map((row) => row.views)),
      likesCount: analytics.totalLikes,
      commentsCount: comments.totalComments,
    },
  };
}

function buildChannelDailyRows({ owner, videoPlans }) {
  const dailyMap = new Map(
    VIDEO_DAYS.map((date) => [
      toDateKey(date),
      {
        date: toDateKey(date),
        views: 0,
        watchTimeSeconds: 0,
        videosPublished: 0,
      },
    ]),
  );

  for (const plan of videoPlans) {
    for (const row of plan.videoDailyRows) {
      const bucket = dailyMap.get(row.date);
      if (!bucket) {
        continue;
      }
      bucket.views += row.views;
      bucket.watchTimeSeconds += row.watchTimeSeconds;
    }

    const publishedKey = toDateKey(plan.publishedAt);
    const publishedBucket = dailyMap.get(publishedKey);
    if (publishedBucket) {
      publishedBucket.videosPublished += 1;
    }
  }

  return VIDEO_DAYS.map((date, index) => {
    const key = toDateKey(date);
    const row = dailyMap.get(key);
    const views = row?.views ?? 0;
    const publishedBoost =
      (row?.videosPublished ?? 0) * seededInt(owner.id, `published-boost-${key}`, 220, 1350);
    const subscribersGained = clamp(
      Math.round(views * (0.00012 + seededFloat(owner.id, `sub-gain-${key}`) * 0.00014)) +
        publishedBoost,
      views > 0 ? 60 : 0,
      Math.max(views > 0 ? 60 : 0, Math.round(views * 0.0012) + publishedBoost),
    );
    const subscribersLost = clamp(
      Math.round(
        subscribersGained * (0.08 + seededFloat(owner.id, `sub-lost-${key}`) * 0.16),
      ) + (index % 9 === 0 ? seededInt(owner.id, `sub-lost-bump-${key}`, 8, 40) : 0),
      subscribersGained > 0 ? 8 : 0,
      Math.max(subscribersGained > 0 ? 8 : 0, Math.round(subscribersGained * 0.45)),
    );

    return {
      id: `seed-cds-${owner.channelId}-${key}`,
      channelId: owner.channelId,
      date: key,
      views,
      watchTimeSeconds: row?.watchTimeSeconds ?? 0,
      subscribersGained,
      subscribersLost,
      videosPublished: row?.videosPublished ?? 0,
    };
  });
}

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

function buildOwnerPlaylistRows({ owner, videoPlans }) {
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

function buildOwnerPlaybackEventRows({ owner, videoPlans }) {
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

export function buildSeedDataset({ items, owner, audienceUsers }) {
  const videoPlans = items.map((item, itemIndex) => buildVideoSeedPlan({ item, itemIndex, owner, audienceUsers }));
  const channelDailyRows = buildChannelDailyRows({ owner, videoPlans });
  const ownerPlaylists = buildOwnerPlaylistRows({ owner, videoPlans });
  const ownerPlaybackEventRows = buildOwnerPlaybackEventRows({ owner, videoPlans });

  return {
    subscribersCount: TEST_CHANNEL_SUBSCRIBERS,
    rows: {
      videos: videoPlans.map((plan) => plan.videoRow),
      videoAssets: videoPlans.flatMap((plan) => plan.videoAssetRows),
      transcodeJobs: videoPlans.map((plan) => plan.transcodeJobRow),
      uploadSessions: videoPlans.map((plan) => plan.uploadSessionRow),
      comments: videoPlans.flatMap((plan) => plan.commentRows),
      commentReactions: videoPlans.flatMap((plan) => plan.commentReactionRows),
      videoDailyStats: videoPlans.flatMap((plan) => plan.videoDailyRows),
      channelDailyStats: channelDailyRows,
      playlists: ownerPlaylists.playlistRows,
      playlistItems: ownerPlaylists.playlistItemRows,
      playbackEvents: ownerPlaybackEventRows,
    },
    summaries: videoPlans.map((plan) => plan.summary),
  };
}
