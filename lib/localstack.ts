import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  SFNClient,
  StopExecutionCommand,
  StartExecutionCommand,
} from "@aws-sdk/client-sfn";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
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
 * 原始视频统一放在 vod-raw/{shortCode}/source.mp4。
 * 处理后 HLS 资源也使用 {shortCode}/ 前缀，保持源文件、转码产物和数据库记录一致。
 */
export function createRawVideoObjectKey(shortCode: string) {
  return `${shortCode}/source.mp4`;
}

/**
 * HLS 输出目录直接使用 shortCode。
 * 播放页最终会读取 {shortCode}/master.m3u8，再由清单继续请求同目录下的切片。
 */
export function createHlsOutputPrefix(shortCode: string) {
  return shortCode;
}

/**
 * LocalStack 本地开发时不预设桶一定存在。
 * 上传或处理前先保证桶可用。
 */
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

/**
 * 生成浏览器直传 S3 的临时 URL。
 * 应用服务器只负责鉴权和签名，不接收视频大文件。
 */
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

/**
 * 启动一次 Step Functions 执行。
 * 输入包含 jobId/videoId 和对象存储位置，供后续 Lambda 处理和回调。
 */
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

/**
 * 生成短期播放签名 URL。
 * 当前 HLS 主路径走代理或 CDN，该函数用于直接访问对象存储的内部场景。
 */
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

export async function stopTranscodeExecution(executionArn: string, cause?: string) {
  if (!executionArn) return;

  await sfnClient.send(
    new StopExecutionCommand({
      executionArn,
      cause: cause?.slice(0, 300) ?? "Canceled by user",
    }),
  );
}
