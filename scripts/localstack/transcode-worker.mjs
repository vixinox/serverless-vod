/**
 * 脚本行为：
 * 1) 轮询 LocalStack SQS 转码队列并读取 jobId。
 * 2) 从 S3 下载源视频，调用 ffmpeg 转码为 HLS，再上传回 HLS 桶。
 * 3) 回写 Prisma 中的 TranscodeJob/Video/VideoAsset 状态并处理重试。
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  DeleteMessageCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { Readable } from "node:stream";
import { spawn } from "node:child_process";
import pg from "pg";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const queueName = process.env.VOD_TRANSCODE_QUEUE_NAME ?? "vod-transcode";
const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

const s3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials,
});

const sqs = new SQSClient({
  region,
  endpoint,
  credentials,
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function runCommand(bin, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd,
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`${bin} failed with code ${code}: ${output}`));
      }
    });
  });
}

async function streamToBuffer(body) {
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

async function getQueueUrl() {
  if (process.env.VOD_TRANSCODE_QUEUE_URL) return process.env.VOD_TRANSCODE_QUEUE_URL;
  const found = await sqs.send(new GetQueueUrlCommand({ QueueName: queueName }));
  if (!found.QueueUrl) {
    throw new Error("Queue URL not found");
  }
  return found.QueueUrl;
}

function guessMimeType(name) {
  if (name.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (name.endsWith(".ts")) return "video/mp2t";
  if (name.endsWith(".mp4")) return "video/mp4";
  return "application/octet-stream";
}

async function downloadSource(bucket, key, targetPath) {
  const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const buffer = await streamToBuffer(obj.Body);
  await writeFile(targetPath, buffer);
}

async function transcodeToHls(inputPath, outputDir) {
  const outputManifest = join(outputDir, "master.m3u8");

  await runCommand(
    ffmpegBin,
    [
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-g",
      "48",
      "-sc_threshold",
      "0",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      "128k",
      "-hls_time",
      "4",
      "-hls_playlist_type",
      "vod",
      "-hls_segment_filename",
      join(outputDir, "seg_%03d.ts"),
      outputManifest,
    ],
    outputDir,
  );

  return outputManifest;
}

async function transcodeLongToHls(inputPath, outputDir) {
  const outputManifest = join(outputDir, "master.m3u8");

  await runCommand(
    ffmpegBin,
    [
      "-y",
      "-i",
      inputPath,
      "-filter_complex",
      "[0:v]split=2[vsrc][v720];[v720]scale=-2:720[v720out]",
      "-map",
      "[vsrc]",
      "-map",
      "0:a?",
      "-c:v:0",
      "libx264",
      "-preset:v:0",
      "veryfast",
      "-g:v:0",
      "48",
      "-sc_threshold:v:0",
      "0",
      "-map",
      "[v720out]",
      "-map",
      "0:a?",
      "-c:v:1",
      "libx264",
      "-preset:v:1",
      "veryfast",
      "-g:v:1",
      "48",
      "-sc_threshold:v:1",
      "0",
      "-c:a",
      "aac",
      "-ar",
      "48000",
      "-b:a",
      "128k",
      "-f",
      "hls",
      "-hls_time",
      "3",
      "-hls_playlist_type",
      "vod",
      "-hls_flags",
      "independent_segments",
      "-hls_segment_filename",
      join(outputDir, "%v", "seg_%03d.ts"),
      "-master_pl_name",
      "master.m3u8",
      "-var_stream_map",
      "v:0,a:0,name:source v:1,a:1,name:720p",
      join(outputDir, "%v", "index.m3u8"),
    ],
    outputDir,
  );

  return outputManifest;
}

async function uploadOutputDirectory(bucket, prefix, outputDir) {
  const files = await readdir(outputDir);

  for (const file of files) {
    const filePath = join(outputDir, file);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) continue;

    const body = await readFile(filePath);
    const key = `${prefix}/${file}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: guessMimeType(file),
      }),
    );
  }
}

async function clearExistingHls(bucket, prefix) {
  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `${prefix}/`,
    }),
  );

  if (!listed.Contents?.length) return;

  for (const obj of listed.Contents) {
    if (!obj.Key) continue;
    await s3.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: obj.Key,
      }),
    );
  }
}

async function markJobRunning(jobId) {
  return prisma.transcodeJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attempt: { increment: 1 },
      lastError: null,
    },
    select: {
      id: true,
      attempt: true,
      maxAttempts: true,
      videoId: true,
      inputBucket: true,
      inputKey: true,
      outputBucket: true,
      outputPrefix: true,
    },
  });
}

async function markSuccess(job) {
  const manifestKey = `${job.outputPrefix}/master.m3u8`;

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: {
        status: "SUCCEEDED",
        finishedAt: new Date(),
      },
    }),
    prisma.video.update({
      where: { id: job.videoId },
      data: {
        processingStatus: "READY",
        processingError: null,
        readyAt: new Date(),
      },
    }),
    prisma.videoAsset.deleteMany({
      where: {
        videoId: job.videoId,
        assetType: "HLS_MASTER",
      },
    }),
    prisma.videoAsset.create({
      data: {
        videoId: job.videoId,
        assetType: "HLS_MASTER",
        storageBucket: job.outputBucket,
        storageKey: manifestKey,
        mimeType: "application/vnd.apple.mpegurl",
        isPrimary: true,
      },
    }),
  ]);
}

async function markFailure(job, error) {
  const finalAttempt = job.attempt >= job.maxAttempts;
  const message = error instanceof Error ? error.message.slice(0, 1000) : "transcode failed";

  await prisma.$transaction([
    prisma.transcodeJob.update({
      where: { id: job.id },
      data: {
        status: finalAttempt ? "FAILED" : "QUEUED",
        lastError: message,
        finishedAt: finalAttempt ? new Date() : null,
      },
    }),
    ...(finalAttempt
      ? [
          prisma.video.update({
            where: { id: job.videoId },
            data: {
              processingStatus: "FAILED",
              processingError: message,
            },
          }),
        ]
      : []),
  ]);

  return finalAttempt;
}

async function processJob(jobId) {
  const job = await markJobRunning(jobId);
  const video = await prisma.video.findUnique({
    where: { id: job.videoId },
    select: { type: true },
  });

  const workDir = await mkdtemp(join(tmpdir(), `vod-${job.id}-`));
  const sourceExt = extname(job.inputKey) || ".mp4";
  const sourcePath = join(workDir, `input${sourceExt}`);
  const outputDir = join(workDir, "out");

  try {
    await mkdir(outputDir, { recursive: true });
    await downloadSource(job.inputBucket, job.inputKey, sourcePath);
    await clearExistingHls(job.outputBucket, job.outputPrefix);
    if (video?.type === "LONG") {
      await transcodeLongToHls(sourcePath, outputDir);
    } else {
      await transcodeToHls(sourcePath, outputDir);
    }
    await uploadOutputDirectory(job.outputBucket, job.outputPrefix, outputDir);
    await markSuccess(job);
    return { success: true, finalFailure: false };
  } catch (error) {
    const finalFailure = await markFailure(job, error);
    console.error(`[job:${job.id}] ${error instanceof Error ? error.message : error}`);
    return { success: false, finalFailure };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  const queueUrl = await getQueueUrl();
  console.log(`[worker] queue: ${queueUrl}`);

  while (true) {
    const received = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 120,
      }),
    );

    if (!received.Messages?.length) continue;

    for (const message of received.Messages) {
      if (!message.ReceiptHandle || !message.Body) continue;

      let jobId = "";
      try {
        const parsed = JSON.parse(message.Body);
        jobId = typeof parsed.jobId === "string" ? parsed.jobId : "";
      } catch {
        jobId = "";
      }

      if (!jobId) {
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
        continue;
      }

      const result = await processJob(jobId);
      if (result.success || result.finalFailure) {
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});