/**
 * 脚本行为：
 * 1) 在 LocalStack 中确保 raw/hls/image 三个 S3 桶存在。
 * 2) 为三个桶配置开发友好的 CORS 与可选宽松访问策略。
 * 3) 创建 Lambda 与 Step Functions 所需的虚拟 IAM 角色（LocalStack 不校验权限，仅需 ARN 合法）。
 */
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import {
  IAMClient,
  CreateRoleCommand,
  GetRoleCommand,
} from "@aws-sdk/client-iam";

const region = process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const rawBucket = process.env.VOD_RAW_BUCKET ?? "vod-raw";
const hlsBucket = process.env.VOD_HLS_BUCKET ?? "vod-hls";
const imageBucket = process.env.VOD_IMAGE_BUCKET ?? "vod-image";
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

const iam = new IAMClient({
  region,
  endpoint,
  credentials,
});

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

/**
 * 在 LocalStack 中创建虚拟 IAM 角色（LocalStack 免费版不做权限校验，仅需 ARN 存在）。
 * Lambda 和 Step Functions 创建时引用这些角色 ARN。
 */
async function ensureIamRole(roleName, services) {
  try {
    await iam.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`[ok] iam role exists: ${roleName}`);
    return;
  } catch {
    // role 不存在，创建
  }

  const assumeRolePolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { Service: services },
        Action: "sts:AssumeRole",
      },
    ],
  });

  await iam.send(
    new CreateRoleCommand({
      RoleName: roleName,
      AssumeRolePolicyDocument: assumeRolePolicy,
    }),
  );
  console.log(`[ok] iam role created: ${roleName}`);
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
  // S3 桶
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

  // IAM 角色（LocalStack 不校验，仅需 ARN 合法供 Lambda/SFN 引用）
  await ensureIamRole("lambda-role",  ["lambda.amazonaws.com"]);
  await ensureIamRole("sfn-role",     ["states.amazonaws.com"]);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});