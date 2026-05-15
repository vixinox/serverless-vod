import "dotenv/config";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const seedRoot = join(process.cwd(), "seed");
const defaultManifestPath = join(seedRoot, "manifests", "stage1-slices.json");

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
const retryMax = Math.max(0, Number.parseInt(process.env.SEED_S3_RETRY_MAX ?? "3", 10));
const retryBaseDelayMs = Math.max(100, Number.parseInt(process.env.SEED_S3_RETRY_BASE_MS ?? "300", 10));
const uploadConcurrencyDefault = normalizeConcurrency(process.env.SEED_S3_CONCURRENCY ?? "10");
const itemConcurrencyDefault = normalizeConcurrency(process.env.SEED_S3_ITEM_CONCURRENCY ?? "4");

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials,
  maxAttempts: 1,
});

function parseArgs(argv) {
  const args = {
    manifestPath: defaultManifestPath,
    from: 0,
    limit: null,
    codes: null,
    dryRun: false,
    force: false,
    uploadRaw: false,
    concurrency: uploadConcurrencyDefault,
    itemConcurrency: itemConcurrencyDefault,
  };

  for (const token of argv) {
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--force") {
      args.force = true;
      continue;
    }
    if (token === "--upload-raw") {
      args.uploadRaw = true;
      continue;
    }
    if (token.startsWith("--manifest=")) {
      args.manifestPath = token.slice("--manifest=".length);
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
      const values = token
        .slice("--codes=".length)
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      args.codes = values.length > 0 ? new Set(values) : null;
      continue;
    }
    if (token.startsWith("--concurrency=")) {
      args.concurrency = normalizeConcurrency(token.slice("--concurrency=".length));
      continue;
    }
    if (token.startsWith("--item-concurrency=")) {
      args.itemConcurrency = normalizeConcurrency(token.slice("--item-concurrency=".length));
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function normalizeConcurrency(raw) {
  const parsed = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 10;
  return Math.min(parsed, 32);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function guessContentType(path) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (lower.endsWith(".ts")) return "video/mp2t";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

function isRetryableError(error) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : undefined;
  const name = "name" in error ? error.name : undefined;
  const statusCode =
    "$metadata" in error && error.$metadata && typeof error.$metadata === "object"
      ? error.$metadata.httpStatusCode
      : undefined;

  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN") return true;
  if (name === "TimeoutError") return true;
  if (typeof statusCode === "number" && (statusCode === 429 || statusCode >= 500)) return true;
  return false;
}

async function readManifest(path) {
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.items)) {
    throw new Error("Invalid manifest format, expected { items: [] }");
  }
  return parsed;
}

function selectItems(manifestItems, args) {
  return manifestItems
    .filter((item) => item?.stage1?.status === "ready")
    .filter((item) => item?.stage2?.status === "seeded")
    .filter((item) => (args.codes ? args.codes.has(item.shortCode) : true))
    .slice(args.from, args.limit ? args.from + args.limit : undefined);
}

async function objectExists(bucket, key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode === 404 || error?.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

async function uploadFileWithRetry({ bucket, key, absPath, contentType }) {
  const body = await readFile(absPath);

  for (let attempt = 0; attempt <= retryMax; attempt += 1) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.byteLength,
        }),
      );
      return { attempts: attempt + 1 };
    } catch (error) {
      const canRetry = attempt < retryMax && isRetryableError(error);
      if (!canRetry) throw error;
      const delayMs = retryBaseDelayMs * 2 ** attempt;
      await sleep(delayMs);
    }
  }
  return { attempts: retryMax + 1 };
}

async function listHlsFiles(hlsDirAbsolute) {
  const entries = await readFileListRecursively(hlsDirAbsolute, hlsDirAbsolute);
  return entries
    .filter((entry) => entry.relativePath.toLowerCase().endsWith(".m3u8") || entry.relativePath.toLowerCase().endsWith(".ts"));
}

async function readFileListRecursively(root, current) {
  const entries = await readdir(current, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const absPath = join(current, entry.name);
    if (entry.isDirectory()) {
      const nested = await readFileListRecursively(root, absPath);
      output.push(...nested);
      continue;
    }

    const relativePath = absPath.slice(root.length + 1).replace(/\\/g, "/");
    output.push({ absPath, relativePath });
  }

  return output;
}

async function mapWithConcurrency(items, limit, worker, onProgress) {
  let index = 0;
  const results = Array.from({ length: items.length });

  async function loop() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;

      results[current] = await worker(items[current], current);
      if (onProgress) onProgress(current + 1, items.length);
    }
  }

  const workers = Array.from({ length: Math.min(limit, Math.max(1, items.length)) }, () => loop());
  await Promise.all(workers);
  return results;
}

function buildUploadPlan(item, args) {
  const shortCode = item.shortCode;
  const hlsDirAbsolute = join(seedRoot, item.outputs.hlsDirRelativePath);
  const thumbnailAbsolute = join(seedRoot, item.outputs.thumbnailRelativePath);
  const rawAbsolute = join(seedRoot, item.source.mp4RelativePath);

  const uploads = [
    {
      label: "thumbnail",
      bucket: imageBucket,
      key: item.outputs.s3Preview.thumbnailKey,
      absPath: thumbnailAbsolute,
      contentType: "image/jpeg",
    },
  ];

  const hls = {
    shortCode,
    hlsDirAbsolute,
    bucket: hlsBucket,
    keyPrefix: `${shortCode}/`,
  };

  if (args.uploadRaw) {
    uploads.push({
      label: "raw",
      bucket: rawBucket,
      key: `${shortCode}/source.mp4`,
      absPath: rawAbsolute,
      contentType: "video/mp4",
    });
  }

  return { hls, uploads };
}

async function ensureLocalFile(path) {
  await stat(path);
}

async function processItem(item, args) {
  const startedAt = new Date();
  const shortCode = item.shortCode;
  const { hls, uploads } = buildUploadPlan(item, args);

  await ensureLocalFile(hls.hlsDirAbsolute);
  const hlsFiles = await listHlsFiles(hls.hlsDirAbsolute);
  if (hlsFiles.length === 0) {
    throw new Error(`No HLS files found in ${hls.hlsDirAbsolute}`);
  }

  const tasks = [];
  for (const file of hlsFiles) {
    tasks.push({
      bucket: hls.bucket,
      key: `${hls.keyPrefix}${file.relativePath}`,
      absPath: file.absPath,
      contentType: guessContentType(file.absPath),
    });
  }

  for (const file of uploads) {
    await ensureLocalFile(file.absPath);
    tasks.push(file);
  }

  let completed = 0;
  const perFileResults = await mapWithConcurrency(
    tasks,
    args.concurrency,
    async (task) => {
      const exists = !args.force ? await objectExists(task.bucket, task.key) : false;
      if (exists) {
        return { uploaded: 0, skipped: 1, retried: 0 };
      }

      const result = await uploadFileWithRetry(task);
      return {
        uploaded: 1,
        skipped: 0,
        retried: result.attempts > 1 ? result.attempts - 1 : 0,
      };
    },
    () => {
      completed += 1;
      if (completed % 50 === 0 || completed === tasks.length) {
        console.log(`[seed-s3] ${shortCode} progress ${completed}/${tasks.length}`);
      }
    },
  );

  let uploaded = 0;
  let skipped = 0;
  let retried = 0;
  for (const fileResult of perFileResults) {
    uploaded += fileResult.uploaded;
    skipped += fileResult.skipped;
    retried += fileResult.retried;
  }

  const finishedAt = new Date();
  return {
    shortCode,
    status: "uploaded",
    uploaded,
    skipped,
    retried,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readManifest(args.manifestPath);
  const selectedItems = selectItems(manifest.items, args);

  if (selectedItems.length === 0) {
    console.log("[seed-s3] no selected items (need stage1=ready and stage2=seeded)");
    return;
  }

  const summary = {
    selected: selectedItems.length,
    uploadedObjects: 0,
    skippedObjects: 0,
    retried: 0,
    failed: 0,
    dryRun: args.dryRun,
    uploadRaw: args.uploadRaw,
    force: args.force,
    concurrency: args.concurrency,
    itemConcurrency: args.itemConcurrency,
  };

  const itemResults = await mapWithConcurrency(selectedItems, args.itemConcurrency, async (item) => {
    const now = new Date().toISOString();

    if (args.dryRun) {
      item.stage3 = {
        status: "dry_run",
        uploaded: 0,
        skipped: 0,
        retried: 0,
        updatedAt: now,
        uploadRaw: args.uploadRaw,
      };
      console.log(`[seed-s3] dry-run ${item.shortCode}`);
      return { failed: false, uploaded: 0, skipped: 0, retried: 0 };
    }

    try {
      const result = await processItem(item, args);
      item.stage3 = {
        status: "uploaded",
        uploaded: result.uploaded,
        skipped: result.skipped,
        retried: result.retried,
        startedAt: result.startedAt,
        finishedAt: result.finishedAt,
        elapsedMs: result.elapsedMs,
        uploadRaw: args.uploadRaw,
      };

      console.log(
        `[seed-s3] ${item.shortCode} uploaded=${result.uploaded} skipped=${result.skipped} retried=${result.retried}`,
      );

      return {
        failed: false,
        uploaded: result.uploaded,
        skipped: result.skipped,
        retried: result.retried,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      item.stage3 = {
        status: "failed",
        uploaded: 0,
        skipped: 0,
        retried: 0,
        error: message,
        updatedAt: now,
        uploadRaw: args.uploadRaw,
      };
      console.error(`[seed-s3] ${item.shortCode} failed: ${message}`);

      return { failed: true, uploaded: 0, skipped: 0, retried: 0 };
    }
  });

  for (const result of itemResults) {
    if (!result) continue;
    if (result.failed) {
      summary.failed += 1;
      continue;
    }
    summary.uploadedObjects += result.uploaded;
    summary.skippedObjects += result.skipped;
    summary.retried += result.retried;
  }

  manifest.stage3 = {
    updatedAt: new Date().toISOString(),
    selectedCount: selectedItems.length,
    uploadedObjects: summary.uploadedObjects,
    skippedObjects: summary.skippedObjects,
    retried: summary.retried,
    failed: summary.failed,
    dryRun: summary.dryRun,
    uploadRaw: summary.uploadRaw,
    force: summary.force,
    concurrency: summary.concurrency,
    itemConcurrency: summary.itemConcurrency,
    from: args.from,
    limit: args.limit,
    codes: args.codes ? Array.from(args.codes).sort() : null,
  };

  await writeFile(args.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  console.log(
    `[seed-s3] done selected=${summary.selected} uploaded=${summary.uploadedObjects} ` +
    `skipped=${summary.skippedObjects} failed=${summary.failed} retried=${summary.retried}`,
  );
}

main().catch((error) => {
  console.error("[seed-s3] failed", error);
  process.exit(1);
});
