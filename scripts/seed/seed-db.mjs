import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildSeedActors } from "./actors.mjs";
import { createPool, defaultManifestPath, DEFAULT_AUDIENCE_USERS, seedRoot } from "./config.mjs";
import { importSeedDataset } from "./import-db.mjs";
import { readManifest, selectReadyItems, writeStage2Manifest } from "./manifest.mjs";
import { buildSeedDataset } from "./planning.mjs";
import { normalizeInt, sum } from "./shared.mjs";

const defaultGeneratedCopyPath = join(seedRoot, "generated", "pexels-video-copy.zh.json");

function normalizeText(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeGeneratedCopyThread(thread, index, shortCode) {
  if (!thread || typeof thread !== "object") {
    throw new Error(`Invalid generated copy thread for ${shortCode} at index=${index}`);
  }

  const rank = ["HOT", "NORMAL", "TAIL"].includes(thread.rank) ? thread.rank : "NORMAL";
  const parent = normalizeText(thread.parent);
  const replies = Array.isArray(thread.replies)
    ? thread.replies.map(normalizeText).filter(Boolean)
    : [];
  if (!parent || replies.length === 0) {
    throw new Error(`Generated copy thread for ${shortCode} is missing parent/replies at index=${index}`);
  }

  return {
    rank,
    topic: normalizeText(thread.topic) ?? "观感",
    parent,
    replies,
  };
}

function normalizeGeneratedCopyItem(item) {
  if (!item || typeof item !== "object" || !item.shortCode) {
    throw new Error("Invalid generated copy item: missing shortCode");
  }

  const titleZh = normalizeText(item.titleZh);
  const descriptionZh = normalizeText(item.descriptionZh);
  if (!titleZh || !descriptionZh) {
    throw new Error(`Generated copy item ${item.shortCode} is missing titleZh/descriptionZh`);
  }

  return {
    ...item,
    titleZh,
    descriptionZh,
    commentThreads: Array.isArray(item.commentThreads)
      ? item.commentThreads.map((thread, index) => normalizeGeneratedCopyThread(thread, index, item.shortCode))
      : [],
  };
}

async function readGeneratedCopyMap(copyPath) {
  try {
    const parsed = JSON.parse(await readFile(copyPath, "utf8"));
    if (!Array.isArray(parsed?.items)) {
      throw new Error("Invalid generated copy file: expected { items: [] }");
    }

    const result = new Map();
    for (const rawItem of parsed.items) {
      const item = normalizeGeneratedCopyItem(rawItem);
      if (result.has(item.shortCode)) {
        throw new Error(`Duplicate generated copy item shortCode=${item.shortCode}`);
      }
      result.set(item.shortCode, item);
    }
    return result;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

function parseArgs(argv) {
  const args = {
    manifestPath: defaultManifestPath,
    copyPath: defaultGeneratedCopyPath,
    useGeneratedCopy: true,
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
    if (token === "--no-generated-copy") {
      args.useGeneratedCopy = false;
      continue;
    }
    if (token.startsWith("--copy=")) {
      args.copyPath = token.slice("--copy=".length);
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

  const generatedCopyByShortCode = args.useGeneratedCopy
    ? await readGeneratedCopyMap(args.copyPath)
    : new Map();
  if (args.useGeneratedCopy) {
    const selectedCopyCount = selectedItems.filter((item) => generatedCopyByShortCode.has(item.shortCode)).length;
    console.log(`[stage2] generated copy matched=${selectedCopyCount}/${selectedItems.length} path=${args.copyPath}`);
  }

  const dataset = buildSeedDataset({
    items: selectedItems,
    owner: actors.owner,
    audienceUsers: actors.audience,
    generatedCopyByShortCode,
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
