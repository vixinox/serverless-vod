import "dotenv/config";
import { buildSeedActors } from "./actors.mjs";
import { createPool, defaultManifestPath, DEFAULT_AUDIENCE_USERS } from "./config.mjs";
import { importSeedDataset } from "./import-db.mjs";
import { readManifest, selectReadyItems, writeStage2Manifest } from "./manifest.mjs";
import { buildSeedDataset } from "./planning.mjs";
import { normalizeInt, sum } from "./shared.mjs";

function parseArgs(argv) {
  const args = {
    manifestPath: defaultManifestPath,
    users: DEFAULT_AUDIENCE_USERS,
    from: 0,
    limit: null,
    codes: null,
    dryRun: false,
  };

  for (const token of argv) {
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token.startsWith("--manifest=")) {
      args.manifestPath = token.slice("--manifest=".length);
      continue;
    }
    if (token.startsWith("--users=")) {
      args.users = normalizeInt(token.slice("--users=".length), DEFAULT_AUDIENCE_USERS, 400000, 10000);
      continue;
    }
    if (token.startsWith("--from=")) {
      const parsed = Number.parseInt(token.slice("--from=".length), 10);
      args.from = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
      continue;
    }
    if (token.startsWith("--limit=")) {
      const parsed = Number.parseInt(token.slice("--limit=".length), 10);
      args.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      continue;
    }
    if (token.startsWith("--codes=")) {
      const parts = token
        .slice("--codes=".length)
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      args.codes = parts.length > 0 ? new Set(parts) : null;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const manifest = await readManifest(args.manifestPath);
  const selectedItems = selectReadyItems(manifest.items, args);
  if (selectedItems.length === 0) {
    console.log("[stage2] no ready items selected");
    return;
  }

  const actors = buildSeedActors(args.users);
  console.log(`[stage2] generated audience users=${actors.audience.length}`);

  const dataset = buildSeedDataset({
    items: selectedItems,
    owner: actors.owner,
    audienceUsers: actors.audience,
  });

  if (!args.dryRun) {
    const pool = createPool();
    try {
      await importSeedDataset({ pool, actors, dataset });
    } finally {
      await pool.end();
    }

    await writeStage2Manifest({
      manifestPath: args.manifestPath,
      manifest,
      selectedItems,
      owner: actors.owner,
      args,
      seededAudienceUsers: actors.audience.length,
      dryRun: args.dryRun,
    });
  }

  for (const result of dataset.summaries) {
    console.log(
      `[stage2] ${result.shortCode} viewsWindow=${result.recentViews} totalViews=${result.totalViews} ` +
      `likes=${result.likesCount} comments=${result.commentsCount}`,
    );
  }

  console.log(
    `[stage2] done ${JSON.stringify({
      selectedVideos: selectedItems.length,
      ownerId: actors.owner.id,
      ownerEmail: actors.owner.email,
      ownerPassword: actors.owner.password,
      audienceUsers: actors.audience.length,
      subscribersCount: dataset.subscribersCount,
      recentViews: sum(dataset.summaries.map((item) => item.recentViews)),
      totalViews: sum(dataset.summaries.map((item) => item.totalViews)),
      commentRows: dataset.rows.comments.length,
      commentReactions: dataset.rows.commentReactions.length,
      videoDailyRows: dataset.rows.videoDailyStats.length,
      channelDailyRows: dataset.rows.channelDailyStats.length,
      playlists: dataset.rows.playlists.length,
      playlistItems: dataset.rows.playlistItems.length,
      playbackEvents: dataset.rows.playbackEvents.length,
      dryRun: args.dryRun,
      manifestPath: args.manifestPath,
    })}`,
  );
}

main().catch((error) => {
  console.error("[stage2] failed", error);
  process.exitCode = 1;
});
