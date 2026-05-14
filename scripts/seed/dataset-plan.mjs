import {
  TEST_CHANNEL_SUBSCRIBERS,
  hlsBucket,
  imageBucket,
  rawBucket,
} from "./config.mjs";
import { buildDailyStatsPlan, resolveViewTier, VIDEO_DAYS } from "./analytics-plan.mjs";
import { buildCommentPlan } from "./comments-plan.mjs";
import { buildOwnerPlaybackEventRows, buildOwnerPlaylistRows } from "./library-plan.mjs";
import { buildLifecycle } from "./video-lifecycle.mjs";
import {
  buildThumbnailUrl,
  deriveDuration,
  deriveType,
  deriveVisibility,
  resolveVideoMetadata,
} from "./video-metadata.mjs";
import {
  clamp,
  seededFloat,
  seededInt,
  sum,
  toDateKey,
} from "./shared.mjs";

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

function buildVideoSeedPlan({ item, itemIndex, owner, audienceUsers, generatedCopy }) {
  const type = deriveType(item);
  const visibility = deriveVisibility(item);
  const duration = deriveDuration(item.shortCode, type);
  const lifecycle = buildLifecycle(item.shortCode);
  const tier = resolveViewTier(itemIndex);
  const totalViews = seededInt(item.shortCode, `total-views-${tier.key}`, tier.totalMin, tier.totalMax);
  const metadata = resolveVideoMetadata(item, generatedCopy);
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
    generatedCopy,
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

export function buildSeedDataset({ items, owner, audienceUsers, generatedCopyByShortCode = new Map() }) {
  const videoPlans = items.map((item, itemIndex) => buildVideoSeedPlan({
    item,
    itemIndex,
    owner,
    audienceUsers,
    generatedCopy: generatedCopyByShortCode.get(item.shortCode) ?? null,
  }));
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
