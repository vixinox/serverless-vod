/**
 * 共享 S3 客户端
 */
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";

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

export async function downloadObject(bucket, key, targetPath) {
  const { writeFile } = await import("node:fs/promises");
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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
  const { readdir, stat, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");

  const root = base ?? dir;
  const entries = await readdir(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      await uploadDirectory(bucket, prefix, fullPath, root);
    } else {
      const relativePath = fullPath.slice(root.length).replace(/\\/g, "/").replace(/^\//, "");
      const key = `${prefix}/${relativePath}`;
      const body = await readFile(fullPath);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: guessMime(entry),
        }),
      );
    }
  }
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
  if (name.endsWith(".ts")) return "video/mp2t";
  if (name.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}
