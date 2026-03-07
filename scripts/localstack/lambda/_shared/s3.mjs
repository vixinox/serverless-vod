/**
 * 共享 S3 客户端与文件传输工具。
 *
 * 提供下载对象、上传单文件/目录、清理前缀对象等能力，
 * 供 transcode Lambda 在各阶段复用。
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { createReadStream, createWriteStream } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";

export const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

export async function streamToBuffer(body) {
  if (!body) return Buffer.alloc(0);
  if (body instanceof Readable) {
    const chunks = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
  if (typeof body.transformToByteArray === "function") {
    return Buffer.from(await body.transformToByteArray());
  }
  return Buffer.from([]);
}

function toReadableStream(body) {
  if (!body) return null;
  if (body instanceof Readable) return body;
  if (typeof body.pipe === "function") return body;
  if (
    typeof Readable.fromWeb === "function" &&
    typeof body.transformToWebStream === "function"
  ) {
    return Readable.fromWeb(body.transformToWebStream());
  }
  return null;
}

export async function downloadObject(bucket, key, targetPath) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const bodyStream = toReadableStream(obj.Body);
  if (bodyStream) {
    await pipeline(bodyStream, createWriteStream(targetPath));
    return;
  }

  const buffer = await streamToBuffer(obj.Body);
  await writeFile(targetPath, buffer);
}

/**
 * 递归上传目录到 S3，支持子目录（LONG 视频多码率 HLS 结构需要）
 * @param {string} bucket
 * @param {string} prefix  - S3 目标前缀
 * @param {string} dir     - 本地目录绝对路径
 * @param {string} [base]  - 递归时保持相对路径基准
 */
export async function uploadDirectory(bucket, prefix, dir, base) {
  const root = base ?? dir;
  const normalizedPrefix = prefix.replace(/\/+$/, "");
  const files = [];
  await collectFiles(dir, files);
  if (!files.length) return;

  const concurrency = resolveUploadConcurrency();
  const workerCount = Math.min(concurrency, files.length);
  let fileIndex = 0;

  async function worker() {
    while (fileIndex < files.length) {
      const currentIndex = fileIndex++;
      const fullPath = files[currentIndex];
      const relativePath = fullPath.slice(root.length).replace(/\\/g, "/").replace(/^\/+/, "");
      const key = normalizedPrefix ? `${normalizedPrefix}/${relativePath}` : relativePath;
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: createReadStream(fullPath),
          ContentType: guessMime(fullPath),
        }),
      );
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}

/**
 * 上传单个本地文件到 S3
 * @param {string} bucket
 * @param {string} key
 * @param {string} filePath  - 本地文件绝对路径
 * @param {string} [contentType] - 可选 Content-Type；未指定时由文件名自动推断
 */
export async function uploadFile(bucket, key, filePath, contentType) {
  const body = await readFile(filePath);
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType ?? guessMime(key),
    }),
  );
}

async function collectFiles(dir, files) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(fullPath, files);
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

function resolveUploadConcurrency() {
  const raw = process.env.UPLOAD_CONCURRENCY ?? "8";
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 8;
  return Math.min(parsed, 32);
}

export async function clearPrefix(bucket, prefix) {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: `${prefix}/` }),
  );
  if (!listed.Contents?.length) return;
  for (const obj of listed.Contents) {
    if (!obj.Key) continue;
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
  }
}

function guessMime(name) {
  if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (name.endsWith(".ts"))   return "video/mp2t";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".png"))  return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
