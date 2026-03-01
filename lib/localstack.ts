import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  SFNClient,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
const sfnStateMachineArn = process.env.VOD_SFN_STATE_MACHINE_ARN ?? "";

const credentials = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

export const localstackConfig = {
  region,
  endpoint,
  rawBucket,
  hlsBucket,
  imageBucket,
  sfnStateMachineArn,
};

export const s3Client = new S3Client({
  region,
  endpoint,
  credentials,
  forcePathStyle,
});

export const sfnClient = new SFNClient({
  region,
  endpoint,
  credentials,
});

/**
 * vod-raw 存储键：{shortCode}/source.mp4
 * 与 vod-hls 的 {shortCode}/ 前缀保持命名空间一致，方便对照调试。
 */
export function createRawVideoObjectKey(shortCode: string) {
  return `${shortCode}/source.mp4`;
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

export async function ensureStateMachineArn(): Promise<string> {
  const explicitArn = process.env.VOD_SFN_STATE_MACHINE_ARN;
  if (explicitArn) return explicitArn;
  throw new Error(
    "VOD_SFN_STATE_MACHINE_ARN 未配置，请先运行 npm run localstack:setup",
  );
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

export interface TranscodeExecutionInput {
  jobId: string;
  videoId: string;
  shortCode: string;
  inputBucket: string;
  inputKey: string;
  outputBucket: string;
  outputPrefix: string;
  videoType: "LONG" | "SHORT";
}

export async function startTranscodeExecution(input: TranscodeExecutionInput) {
  const stateMachineArn = await ensureStateMachineArn();
  const response = await sfnClient.send(
    new StartExecutionCommand({
      stateMachineArn,
      name: `vod-${input.shortCode}-${Date.now()}`,
      input: JSON.stringify(input),
    }),
  );

  return {
    executionArn: response.executionArn ?? null,
    startDate: response.startDate ?? null,
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