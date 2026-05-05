import { hashPassword } from "better-auth/crypto";
import {
  AUDIENCE_USER_PREFIX,
  COMMENT_BATCH_SIZE,
  DAILY_STATS_BATCH_SIZE,
  LEGACY_CREATOR_PREFIX,
  OWNER_CREATED_AT,
  REACTION_BATCH_SIZE,
  SETTINGS_BATCH_SIZE,
  USER_BATCH_SIZE,
} from "./config.mjs";

async function insertJsonBatches(client, { label, tableName, columns, recordset, rows, batchSize }) {
  if (!rows.length) {
    return;
  }

  const columnList = columns.join(", ");
  const selectList = columns.map((column) => `src.${column}`).join(", ");
  const recordsetList = recordset.join(", ");

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    await client.query(
      `
        INSERT INTO ${tableName} (${columnList})
        SELECT ${selectList}
        FROM jsonb_to_recordset($1::jsonb) AS src(${recordsetList})
      `,
      [JSON.stringify(batch)],
    );
  }

  console.log(`[stage2] imported ${label} rows=${rows.length}`);
}

async function cleanupExistingSeedDataFast(client) {
  const result = await client.query(
    `
      DELETE FROM "user"
      WHERE "id" = $1
         OR "id" LIKE $2
         OR "id" LIKE $3
    `,
    ["seed-demo-user", `${AUDIENCE_USER_PREFIX}%`, `${LEGACY_CREATOR_PREFIX}%`],
  );
  return result.rowCount ?? 0;
}

async function enableFastImportMode(client) {
  await client.query("SET LOCAL statement_timeout = 0");
  await client.query("SET LOCAL lock_timeout = 0");
  await client.query("SET LOCAL synchronous_commit = OFF");
  await client.query("SAVEPOINT seed_fast_mode");

  try {
    await client.query("SET LOCAL session_replication_role = replica");
    await client.query("RELEASE SAVEPOINT seed_fast_mode");
    return { triggersDisabled: true };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT seed_fast_mode");
    await client.query("RELEASE SAVEPOINT seed_fast_mode");
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[stage2] fast-import fallback: unable to disable triggers (${message})`);
    return { triggersDisabled: false };
  }
}

async function insertSeedActors(client, { owner, audience, subscribersCount }) {
  const ownerUpdatedAt = new Date();
  const passwordHash = await hashPassword(owner.password);

  const userRows = [
    {
      id: owner.id,
      name: owner.name,
      email: owner.email,
      emailVerified: true,
      image: null,
      createdAt: OWNER_CREATED_AT.toISOString(),
      updatedAt: ownerUpdatedAt.toISOString(),
    },
    ...audience.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      image: null,
      createdAt: user.createdAt,
      updatedAt: ownerUpdatedAt.toISOString(),
    })),
  ];

  const settingsRows = [
    {
      userId: owner.id,
      theme: "SYSTEM",
      updatedAt: ownerUpdatedAt.toISOString(),
    },
    ...audience.map((user) => ({
      userId: user.id,
      theme: user.theme,
      updatedAt: ownerUpdatedAt.toISOString(),
    })),
  ];

  await insertJsonBatches(client, {
    label: "users",
    tableName: "\"user\"",
    columns: ["\"id\"", "\"name\"", "\"email\"", "\"emailVerified\"", "\"image\"", "\"createdAt\"", "\"updatedAt\""],
    recordset: [
      "\"id\" text",
      "\"name\" text",
      "\"email\" text",
      "\"emailVerified\" boolean",
      "\"image\" text",
      "\"createdAt\" timestamptz",
      "\"updatedAt\" timestamptz",
    ],
    rows: userRows,
    batchSize: USER_BATCH_SIZE,
  });

  await insertJsonBatches(client, {
    label: "user_settings",
    tableName: "\"user_settings\"",
    columns: ["\"userId\"", "\"theme\"", "\"updatedAt\""],
    recordset: ["\"userId\" text", "\"theme\" \"ThemePreference\"", "\"updatedAt\" timestamptz"],
    rows: settingsRows,
    batchSize: SETTINGS_BATCH_SIZE,
  });

  await insertJsonBatches(client, {
    label: "accounts",
    tableName: "\"account\"",
    columns: ["\"id\"", "\"accountId\"", "\"providerId\"", "\"userId\"", "\"password\"", "\"createdAt\"", "\"updatedAt\""],
    recordset: [
      "\"id\" text",
      "\"accountId\" text",
      "\"providerId\" text",
      "\"userId\" text",
      "\"password\" text",
      "\"createdAt\" timestamptz",
      "\"updatedAt\" timestamptz",
    ],
    rows: [
      {
        id: `${owner.id}-credential`,
        accountId: owner.id,
        providerId: "credential",
        userId: owner.id,
        password: passwordHash,
        createdAt: OWNER_CREATED_AT.toISOString(),
        updatedAt: OWNER_CREATED_AT.toISOString(),
      },
    ],
    batchSize: 1,
  });

  await insertJsonBatches(client, {
    label: "channels",
    tableName: "\"Channel\"",
    columns: [
      "\"id\"",
      "\"ownerId\"",
      "\"name\"",
      "\"banner\"",
      "\"description\"",
      "\"subscribersCount\"",
      "\"createdAt\"",
      "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text",
      "\"ownerId\" text",
      "\"name\" text",
      "\"banner\" text",
      "\"description\" text",
      "\"subscribersCount\" int",
      "\"createdAt\" timestamptz",
      "\"updatedAt\" timestamptz",
    ],
    rows: [
      {
        id: owner.channelId,
        ownerId: owner.id,
        name: owner.channelName,
        banner: null,
        description: owner.channelDescription,
        subscribersCount,
        createdAt: OWNER_CREATED_AT.toISOString(),
        updatedAt: ownerUpdatedAt.toISOString(),
      },
    ],
    batchSize: 1,
  });
}

async function insertDataset(client, dataset) {
  await insertJsonBatches(client, {
    label: "videos",
    tableName: "\"Video\"",
    columns: [
      "\"id\"", "\"title\"", "\"description\"", "\"shortCode\"", "\"thumbnail\"", "\"duration\"",
      "\"type\"", "\"visibility\"", "\"processingStatus\"", "\"publishAt\"", "\"publishedAt\"", "\"readyAt\"",
      "\"processingError\"", "\"userId\"", "\"channelId\"", "\"views\"", "\"likesCount\"", "\"dislikesCount\"",
      "\"commentsCount\"", "\"deletedAt\"", "\"createdAt\"", "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"title\" text", "\"description\" text", "\"shortCode\" text", "\"thumbnail\" text", "\"duration\" int",
      "\"type\" \"VideoType\"", "\"visibility\" \"Visibility\"", "\"processingStatus\" \"VideoProcessingStatus\"",
      "\"publishAt\" timestamptz", "\"publishedAt\" timestamptz", "\"readyAt\" timestamptz", "\"processingError\" text",
      "\"userId\" text", "\"channelId\" text", "\"views\" bigint", "\"likesCount\" int", "\"dislikesCount\" int",
      "\"commentsCount\" int", "\"deletedAt\" timestamptz", "\"createdAt\" timestamptz", "\"updatedAt\" timestamptz",
    ],
    rows: dataset.rows.videos,
    batchSize: 500,
  });

  await insertJsonBatches(client, {
    label: "video_assets",
    tableName: "\"VideoAsset\"",
    columns: [
      "\"id\"", "\"videoId\"", "\"assetType\"", "\"qualityLabel\"", "\"mimeType\"",
      "\"storageBucket\"", "\"storageKey\"", "\"isPrimary\"", "\"createdAt\"", "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"videoId\" text", "\"assetType\" \"VideoAssetType\"", "\"qualityLabel\" text", "\"mimeType\" text",
      "\"storageBucket\" text", "\"storageKey\" text", "\"isPrimary\" boolean", "\"createdAt\" timestamptz", "\"updatedAt\" timestamptz",
    ],
    rows: dataset.rows.videoAssets,
    batchSize: 1000,
  });

  await insertJsonBatches(client, {
    label: "transcode_jobs",
    tableName: "\"TranscodeJob\"",
    columns: [
      "\"id\"", "\"videoId\"", "\"provider\"", "\"queueMessageId\"", "\"inputBucket\"", "\"inputKey\"",
      "\"outputBucket\"", "\"outputPrefix\"", "\"status\"", "\"attempt\"", "\"maxAttempts\"", "\"pipelineStage\"",
      "\"lastError\"", "\"queuedAt\"", "\"startedAt\"", "\"finishedAt\"", "\"createdAt\"", "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"videoId\" text", "\"provider\" \"TranscodeProvider\"", "\"queueMessageId\" text", "\"inputBucket\" text",
      "\"inputKey\" text", "\"outputBucket\" text", "\"outputPrefix\" text", "\"status\" \"TranscodeJobStatus\"",
      "\"attempt\" int", "\"maxAttempts\" int", "\"pipelineStage\" text", "\"lastError\" text",
      "\"queuedAt\" timestamptz", "\"startedAt\" timestamptz", "\"finishedAt\" timestamptz",
      "\"createdAt\" timestamptz", "\"updatedAt\" timestamptz",
    ],
    rows: dataset.rows.transcodeJobs,
    batchSize: 1000,
  });

  await insertJsonBatches(client, {
    label: "upload_sessions",
    tableName: "\"UploadSession\"",
    columns: [
      "\"id\"", "\"videoId\"", "\"uploaderId\"", "\"storageBucket\"", "\"objectKey\"", "\"multipartUploadId\"",
      "\"partCount\"", "\"status\"", "\"expiresAt\"", "\"completedAt\"", "\"abortedAt\"", "\"createdAt\"", "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"videoId\" text", "\"uploaderId\" text", "\"storageBucket\" text", "\"objectKey\" text",
      "\"multipartUploadId\" text", "\"partCount\" int", "\"status\" \"UploadSessionStatus\"", "\"expiresAt\" timestamptz",
      "\"completedAt\" timestamptz", "\"abortedAt\" timestamptz", "\"createdAt\" timestamptz", "\"updatedAt\" timestamptz",
    ],
    rows: dataset.rows.uploadSessions,
    batchSize: 1000,
  });

  await insertJsonBatches(client, {
    label: "playlists",
    tableName: "\"Playlist\"",
    columns: [
      "\"id\"", "\"ownerId\"", "\"title\"", "\"description\"", "\"isPublic\"",
      "\"systemKey\"", "\"createdAt\"", "\"updatedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"ownerId\" text", "\"title\" text", "\"description\" text", "\"isPublic\" boolean",
      "\"systemKey\" \"SystemPlaylistKey\"", "\"createdAt\" timestamptz", "\"updatedAt\" timestamptz",
    ],
    rows: dataset.rows.playlists,
    batchSize: 1000,
  });

  await insertJsonBatches(client, {
    label: "playlist_items",
    tableName: "\"PlaylistItem\"",
    columns: [
      "\"id\"", "\"playlistId\"", "\"videoId\"", "\"addedById\"", "\"position\"", "\"createdAt\"",
    ],
    recordset: [
      "\"id\" text", "\"playlistId\" text", "\"videoId\" text", "\"addedById\" text", "\"position\" int",
      "\"createdAt\" timestamptz",
    ],
    rows: dataset.rows.playlistItems,
    batchSize: 1000,
  });

  await insertJsonBatches(client, {
    label: "video_playback_events",
    tableName: "\"VideoPlaybackEvent\"",
    columns: [
      "\"id\"", "\"videoId\"", "\"userId\"", "\"sessionId\"", "\"eventType\"", "\"positionSeconds\"",
      "\"durationSeconds\"", "\"watchDeltaMs\"", "\"playbackRate\"", "\"isMuted\"", "\"volume\"",
      "\"qualityLabel\"", "\"source\"", "\"referrer\"", "\"userAgent\"", "\"ipHash\"", "\"countryCode\"", "\"createdAt\"",
    ],
    recordset: [
      "\"id\" text", "\"videoId\" text", "\"userId\" text", "\"sessionId\" text", "\"eventType\" \"PlaybackEventType\"",
      "\"positionSeconds\" int", "\"durationSeconds\" int", "\"watchDeltaMs\" int", "\"playbackRate\" numeric",
      "\"isMuted\" boolean", "\"volume\" int", "\"qualityLabel\" text", "\"source\" text", "\"referrer\" text",
      "\"userAgent\" text", "\"ipHash\" text", "\"countryCode\" text", "\"createdAt\" timestamptz",
    ],
    rows: dataset.rows.playbackEvents,
    batchSize: 3000,
  });

  await insertJsonBatches(client, {
    label: "comments",
    tableName: "\"Comment\"",
    columns: [
      "\"id\"", "\"content\"", "\"userId\"", "\"videoId\"", "\"parentId\"", "\"repliesCount\"",
      "\"likesCount\"", "\"dislikesCount\"", "\"createdAt\"", "\"updatedAt\"", "\"deletedAt\"",
    ],
    recordset: [
      "\"id\" text", "\"content\" text", "\"userId\" text", "\"videoId\" text", "\"parentId\" text",
      "\"repliesCount\" int", "\"likesCount\" int", "\"dislikesCount\" int", "\"createdAt\" timestamptz",
      "\"updatedAt\" timestamptz", "\"deletedAt\" timestamptz",
    ],
    rows: dataset.rows.comments,
    batchSize: COMMENT_BATCH_SIZE,
  });

  await insertJsonBatches(client, {
    label: "comment_reactions",
    tableName: "\"CommentReaction\"",
    columns: ["\"userId\"", "\"commentId\"", "\"reactionType\"", "\"createdAt\""],
    recordset: ["\"userId\" text", "\"commentId\" text", "\"reactionType\" \"ReactionType\"", "\"createdAt\" timestamptz"],
    rows: dataset.rows.commentReactions,
    batchSize: REACTION_BATCH_SIZE,
  });

  await insertJsonBatches(client, {
    label: "video_daily_stats",
    tableName: "\"VideoDailyStat\"",
    columns: [
      "\"id\"",
      "\"videoId\"",
      "\"date\"",
      "\"views\"",
      "\"uniqueViewers\"",
      "\"watchTimeSeconds\"",
      "\"likesGained\"",
      "\"dislikesGained\"",
      "\"commentsGained\"",
    ],
    recordset: [
      "\"id\" text",
      "\"videoId\" text",
      "\"date\" date",
      "\"views\" bigint",
      "\"uniqueViewers\" int",
      "\"watchTimeSeconds\" bigint",
      "\"likesGained\" int",
      "\"dislikesGained\" int",
      "\"commentsGained\" int",
    ],
    rows: dataset.rows.videoDailyStats,
    batchSize: DAILY_STATS_BATCH_SIZE,
  });

  await insertJsonBatches(client, {
    label: "channel_daily_stats",
    tableName: "\"ChannelDailyStat\"",
    columns: [
      "\"id\"",
      "\"channelId\"",
      "\"date\"",
      "\"views\"",
      "\"watchTimeSeconds\"",
      "\"subscribersGained\"",
      "\"subscribersLost\"",
      "\"videosPublished\"",
    ],
    recordset: [
      "\"id\" text",
      "\"channelId\" text",
      "\"date\" date",
      "\"views\" bigint",
      "\"watchTimeSeconds\" bigint",
      "\"subscribersGained\" int",
      "\"subscribersLost\" int",
      "\"videosPublished\" int",
    ],
    rows: dataset.rows.channelDailyStats,
    batchSize: DAILY_STATS_BATCH_SIZE,
  });
}

export async function importSeedDataset({ pool, actors, dataset }) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const cleanedUsers = await cleanupExistingSeedDataFast(client);
    if (cleanedUsers > 0) {
      console.log(`[stage2] cleaned previous seed users=${cleanedUsers}`);
    }

    const fastMode = await enableFastImportMode(client);
    console.log(`[stage2] import mode triggersDisabled=${fastMode.triggersDisabled}`);

    await insertSeedActors(client, {
      owner: actors.owner,
      audience: actors.audience,
      subscribersCount: dataset.subscribersCount,
    });
    await insertDataset(client, dataset);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
