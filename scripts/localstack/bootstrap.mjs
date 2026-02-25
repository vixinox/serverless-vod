/**
 * 脚本行为：
 * 1) 在 LocalStack 中确保 raw/hls/image 三个 S3 桶存在。
 * 2) 为这三个桶配置开发友好的 CORS 与可选宽松访问策略。
 * 3) 确保转码队列存在，并输出队列 URL。
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { CreateQueueCommand, GetQueueUrlCommand, SQSClient } from "@aws-sdk/client-sqs";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
const queueName = process.env.VOD_TRANSCODE_QUEUE_NAME ?? "vod-transcode";
const hlsPublicRead = process.env.VOD_HLS_PUBLIC_READ !== "false";
const imagePublicRead = process.env.VOD_IMAGE_PUBLIC_READ !== "false";
const devOpenAccess = process.env.VOD_S3_DEV_OPEN_ACCESS !== "false";
const corsOrigins = (process.env.VOD_S3_CORS_ORIGINS ?? "*")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const corsMethods = (process.env.VOD_S3_CORS_METHODS ?? "GET,HEAD,PUT,POST,DELETE")
  .split(",")
  .map((item) => item.trim().toUpperCase())
  .filter(Boolean);

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

function isSqsDisabledError(error) {
  const message = error?.Error?.Message ?? error?.message ?? "";
  return typeof message === "string" && message.includes("Service 'sqs' is not enabled");
}

function withSqsHint(error) {
  if (!isSqsDisabledError(error)) return error;

  return new Error(
    [
      "LocalStack SQS service is disabled.",
      "Set LOCALSTACK_SERVICES=s3,sqs and recreate the localstack container.",
      "Example: docker compose up -d --force-recreate localstack",
    ].join(" "),
    { cause: error },
  );
}

async function ensureBucket(bucket) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`[ok] bucket exists: ${bucket}`);
    return;
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[ok] bucket created: ${bucket}`);
  }
}

async function ensureQueue(name) {
  try {
    const found = await sqs.send(new GetQueueUrlCommand({ QueueName: name }));
    if (found.QueueUrl) {
      console.log(`[ok] queue exists: ${name}`);
      console.log(`VOD_TRANSCODE_QUEUE_URL=${found.QueueUrl}`);
      return;
    }
  } catch (error) {
    const handled = withSqsHint(error);
    if (handled !== error) throw handled;

    try {
      const created = await sqs.send(new CreateQueueCommand({ QueueName: name }));
      console.log(`[ok] queue created: ${name}`);
      console.log(`VOD_TRANSCODE_QUEUE_URL=${created.QueueUrl}`);
      return;
    } catch (createError) {
      throw withSqsHint(createError);
    }
  }

  throw new Error(`cannot ensure queue: ${name}`);
}

async function ensureBucketCors(bucket) {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ["*"],
            AllowedMethods: corsMethods,
            AllowedOrigins: corsOrigins,
            ExposeHeaders: ["ETag", "Content-Length", "Content-Type"],
            MaxAgeSeconds: 3000,
          },
        ],
      },
    }),
  );
  console.log(`[ok] bucket cors configured: ${bucket}`);
}

async function ensurePublicRead(bucket, enabled, label) {
  if (!enabled) {
    console.log(`[skip] ${label} public-read disabled: ${bucket}`);
    return;
  }

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "PublicReadForHls",
        Effect: "Allow",
        Principal: "*",
        Action: ["s3:GetObject"],
        Resource: `arn:aws:s3:::${bucket}/*`,
      },
    ],
  };

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    }),
  );

  console.log(`[ok] ${label} public-read policy configured: ${bucket}`);
}

async function ensureDevOpenAccess(bucket) {
  if (!devOpenAccess) {
    console.log(`[skip] dev open-access disabled: ${bucket}`);
    return;
  }

  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Sid: "DevOpenBucket",
        Effect: "Allow",
        Principal: "*",
        Action: [
          "s3:ListBucket",
          "s3:GetBucketLocation",
          "s3:ListBucketMultipartUploads",
        ],
        Resource: `arn:aws:s3:::${bucket}`,
      },
      {
        Sid: "DevOpenObjects",
        Effect: "Allow",
        Principal: "*",
        Action: [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ],
        Resource: `arn:aws:s3:::${bucket}/*`,
      },
    ],
  };

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(policy),
    }),
  );

  console.log(`[ok] dev open-access policy configured: ${bucket}`);
}

async function main() {
  await ensureBucket(rawBucket);
  await ensureBucket(hlsBucket);
  await ensureBucket(imageBucket);
  await ensureBucketCors(rawBucket);
  await ensureBucketCors(hlsBucket);
  await ensureBucketCors(imageBucket);
  await ensureDevOpenAccess(rawBucket);
  await ensureDevOpenAccess(hlsBucket);
  await ensureDevOpenAccess(imageBucket);
  await ensurePublicRead(hlsBucket, hlsPublicRead, "hls");
  await ensurePublicRead(imageBucket, imagePublicRead, "image");
  await ensureQueue(queueName);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});