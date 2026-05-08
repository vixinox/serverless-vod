import {
  COMMENT_FOLLOWUPS,
  COMMENT_OPENERS,
  SEEDED_COMMENT_PREFIX,
} from "./config.mjs";
import { buildCommentDistributionWeights } from "./analytics-plan.mjs";
import { clampTimestampToNow } from "./video-lifecycle.mjs";
import {
  distributeIntegers,
  maybeChoice,
  pickSeededSubset,
  seededInt,
  sortBySeed,
  toDateKey,
} from "./shared.mjs";

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

export function buildCommentPlan({ shortCode, videoId, audienceUsers, dailyRows, tierKey }) {
  const totalComments = seededInt(shortCode, "total-comments", 50, 100);
  const parentCount = Math.min(totalComments - 1, seededInt(shortCode, "parent-comments", 12, 24));
  const replyCount = totalComments - parentCount;
  const hotParentCount = Math.min(parentCount, seededInt(shortCode, "hot-parent-count", 3, 5));
  const commentAuthors = pickSeededSubset(audienceUsers, shortCode, "comment-authors", totalComments);
  const dayWeights = buildCommentDistributionWeights({ shortCode, dailyRows });
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
