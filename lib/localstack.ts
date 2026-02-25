import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  CreateQueueCommand,
  GetQueueUrlCommand,
  SendMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const transcodeQueueName = process.env.VOD_TRANSCODE_QUEUE_NAME ?? "vod-transcode";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

let cachedQueueUrl: string | null = null;

export const localstackConfig = {
  region,
  endpoint,
  rawBucket,
  hlsBucket,
  transcodeQueueName,
};

export const s3Client = new S3Client({
  region,
  endpoint,
  credentials,
  forcePathStyle,
});

export const sqsClient = new SQSClient({
  region,
  endpoint,
  credentials,
});

export function createRawVideoObjectKey(videoId: string, filename: string) {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `raw/${videoId}/${Date.now()}-${safeName}`;
}

export function createHlsOutputPrefix(shortCode: string) {
  return shortCode;
}

export async function ensureBucket(bucket: string) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

export async function ensureQueueUrl() {
  if (cachedQueueUrl) return cachedQueueUrl;

  const explicitQueueUrl = process.env.VOD_TRANSCODE_QUEUE_URL;
  if (explicitQueueUrl) {
    cachedQueueUrl = explicitQueueUrl;
    return cachedQueueUrl;
  }

  try {
    const response = await sqsClient.send(
      new GetQueueUrlCommand({
        QueueName: transcodeQueueName,
      }),
    );
    cachedQueueUrl = response.QueueUrl ?? null;
  } catch {
    const created = await sqsClient.send(
      new CreateQueueCommand({
        QueueName: transcodeQueueName,
      }),
    );
    cachedQueueUrl = created.QueueUrl ?? null;
  }

  if (!cachedQueueUrl) {
    throw new Error("无法获取 transcode queue URL");
  }

  return cachedQueueUrl;
}

export async function createUploadPresignedUrl(params: {
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds?: number;
}) {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
  });

  const expiresIn = params.expiresInSeconds ?? 900;
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function enqueueTranscodeJob(messageBody: Record<string, unknown>) {
  const queueUrl = await ensureQueueUrl();
  const response = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody),
    }),
  );

  return {
    queueUrl,
    messageId: response.MessageId ?? null,
  };
}

export function createPublicLikeObjectUrl(bucket: string, key: string) {
  const cleanEndpoint = endpoint.replace(/\/$/, "");
  return `${cleanEndpoint}/${bucket}/${key}`;
}

export async function createPlaybackSignedUrl(params: {
  bucket: string;
  key: string;
  expiresInSeconds?: number;
}) {
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn: params.expiresInSeconds ?? 900,
  });
}