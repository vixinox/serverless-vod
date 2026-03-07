/**
 * 脚本行为：
 * 1) 读取 seed.ts 产出的本地文件（seed/raw-videos、seed/hls-videos、seed/images）。
 * 2) 仅负责把这批文件上传到 LocalStack S3。
 * 3) raw-videos 上传到 VOD_RAW_BUCKET，hls-videos 上传到 VOD_HLS_BUCKET，images 上传到 VOD_IMAGE_BUCKET。
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile, readdir } from "node:fs/promises";
import { Agent } from "node:http";
import { join, relative } from "node:path";
import { NodeHttpHandler } from "@smithy/node-http-handler";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
const seedRoot = join(process.cwd(), "seed");
const seedDirs = [join(seedRoot, "raw-videos"), join(seedRoot, "hls-videos"), join(seedRoot, "images")];
const uploadConcurrency = 8;
const retryMax = 3;
const retryBaseDelayMs = 300;

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials,
  requestHandler: new NodeHttpHandler({
    httpAgent: new Agent({
      keepAlive: true,
      maxSockets: Number.MAX_SAFE_INTEGER,
    }),
  }),
  maxAttempts: 1,
});

async function walk(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, files);
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getBucketForFile(filePath) {
  const relativePath = relative(seedRoot, filePath).replace(/\\/g, "/");

  if (relativePath.startsWith("raw-videos/")) return rawBucket;
  if (relativePath.startsWith("hls-videos/")) return hlsBucket;
  if (relativePath.startsWith("images/")) return imageBucket;

  return null;
}

function getObjectKeyForFile(filePath) {
  const relativePath = relative(seedRoot, filePath).replace(/\\/g, "/");

  if (relativePath.startsWith("raw-videos/")) {
    return `seed/${relativePath}`;
  }

  if (relativePath.startsWith("hls-videos/")) {
    return relativePath.slice("hls-videos/".length);
  }

  if (relativePath.startsWith("images/")) {
    return relativePath;
  }

  return null;
}

function guessContentType(filePath) {
  if (filePath.endsWith(".mp4")) return "video/mp4";
  if (filePath.endsWith(".mov")) return "video/quicktime";
  if (filePath.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (filePath.endsWith(".ts")) return "video/mp2t";
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
  if (filePath.endsWith(".png")) return "image/png";
  if (filePath.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function isRetryableError(error) {
  if (!error || typeof error !== "object") return false;

  const code = "code" in error ? error.code : null;
  const name = "name" in error ? error.name : null;
  const statusCode =
    "$metadata" in error && error.$metadata && typeof error.$metadata === "object"
      ? error.$metadata.httpStatusCode
      : undefined;

  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "EAI_AGAIN") return true;
  if (name === "TimeoutError") return true;
  if (typeof statusCode === "number" && (statusCode === 429 || statusCode >= 500)) return true;

  return false;
}

async function uploadFileWithRetry(filePath, bucket, key) {
  const body = await readFile(filePath);

  for (let attempt = 0; attempt <= retryMax; attempt += 1) {
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: guessContentType(filePath),
        }),
      );

      return { attempts: attempt + 1 };
    } catch (error) {
      const canRetry = attempt < retryMax && isRetryableError(error);

      if (!canRetry) {
        throw error;
      }

      const delayMs = retryBaseDelayMs * 2 ** attempt;
      await sleep(delayMs);
    }
  }

  return { attempts: retryMax + 1 };
}

function renderProgress({ completed, total, success, failed, retried }) {
  const ratio = total === 0 ? 1 : completed / total;
  const width = 24;
  const filled = Math.round(ratio * width);
  const bar = `${"#".repeat(filled)}${"-".repeat(width - filled)}`;
  const pct = Math.floor(ratio * 100)
    .toString()
    .padStart(3, " ");

  return `[${bar}] ${pct}% (${completed}/${total}) ok=${success} fail=${failed} retry=${retried}`;
}

function writeProgressLine(progress) {
  const line = renderProgress(progress);

  if (process.stdout.isTTY) {
    process.stdout.write(`\r${line}`);
  } else if (progress.completed === progress.total || progress.completed % 25 === 0) {
    console.log(line);
  }
}

async function forEachWithConcurrency(items, limit, worker) {
  const inFlight = new Set();

  for (const item of items) {
    const task = Promise.resolve().then(() => worker(item));
    inFlight.add(task);

    task.finally(() => {
      inFlight.delete(task);
    });

    if (inFlight.size >= limit) {
      await Promise.race(inFlight);
    }
  }

  await Promise.all(inFlight);
}

async function main() {
  const files = [];

  for (const dirPath of seedDirs) {
    try {
      await walk(dirPath, files);
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        console.log(`[skip] directory not found: ${dirPath}`);
        continue;
      }
      throw error;
    }
  }

  if (files.length === 0) {
    console.log("[skip] no seed output files found");
    return;
  }

  const progress = {
    total: files.length,
    completed: 0,
    success: 0,
    failed: 0,
    retried: 0,
  };
  const failedUploads = [];

  writeProgressLine(progress);

  await forEachWithConcurrency(files, uploadConcurrency, async (filePath) => {
    try {
      const key = getObjectKeyForFile(filePath);
      const bucket = getBucketForFile(filePath);

      if (!bucket || !key) {
        progress.success += 1;
        progress.completed += 1;
        writeProgressLine(progress);
        return;
      }

      const result = await uploadFileWithRetry(filePath, bucket, key);
      progress.success += 1;
      if (result.attempts > 1) {
        progress.retried += result.attempts - 1;
      }
    } catch (error) {
      progress.failed += 1;
      failedUploads.push({ filePath, error });
    } finally {
      progress.completed += 1;
      writeProgressLine(progress);
    }
  });

  if (process.stdout.isTTY) {
    process.stdout.write("\n");
  }

  console.log(
    `[done] total=${progress.total} success=${progress.success} failed=${progress.failed} retried=${progress.retried}`,
  );

  if (failedUploads.length > 0) {
    const sample = failedUploads.slice(0, 5);
    for (const item of sample) {
      const message = item.error instanceof Error ? item.error.message : String(item.error);
      console.error(`[error] ${item.filePath} -> ${message}`);
    }
    if (failedUploads.length > sample.length) {
      console.error(`[error] ... and ${failedUploads.length - sample.length} more failed uploads`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});