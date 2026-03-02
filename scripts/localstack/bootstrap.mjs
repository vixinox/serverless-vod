/**
 * bootstrap-all.mjs  （原 bootstrap.mjs + bootstrap-all.mjs 合并）
 *
 * 一键初始化本地开发环境：
 *   1. 创建 S3 桶、配置 CORS/策略、IAM 角色、EventBridge 事件总线（本文件内联）
 *   2. 部署四个 Lambda 函数（deploy-lambdas.mjs 子进程）
 *   3. 创建/更新 Step Functions 状态机（deploy-sfn.mjs 子进程）
 *
 * 用法：npm run localstack:setup
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
import {
  EventBridgeClient,
  CreateEventBusCommand,
  DescribeEventBusCommand,
} from "@aws-sdk/client-eventbridge";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

// ── 配置 ─────────────────────────────────────────────────────────────────

const here     = import.meta.dirname;
const region   = process.env.AWS_DEFAULT_REGION  ?? "us-east-1";
const endpoint = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";

const rawBucket     = process.env.VOD_RAW_BUCKET    ?? "vod-raw";
const hlsBucket     = process.env.VOD_HLS_BUCKET    ?? "vod-hls";
const imageBucket   = process.env.VOD_IMAGE_BUCKET  ?? "vod-image";
const eventBusName  = process.env.VOD_EVENT_BUS     ?? "vod-events";

const hlsPublicRead   = process.env.VOD_HLS_PUBLIC_READ   !== "false";
const imagePublicRead = process.env.VOD_IMAGE_PUBLIC_READ !== "false";
const devOpenAccess   = process.env.VOD_S3_DEV_OPEN_ACCESS !== "false";

const corsOrigins = (process.env.VOD_S3_CORS_ORIGINS ?? "*")
  .split(",").map((s) => s.trim()).filter(Boolean);
const corsMethods = (process.env.VOD_S3_CORS_METHODS ?? "GET,HEAD,PUT,POST,DELETE")
  .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

const credentials = {
  accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
};

const s3  = new S3Client({ region, endpoint, forcePathStyle: true, credentials });
const iam = new IAMClient({ region, endpoint, credentials });
const eb  = new EventBridgeClient({ region, endpoint, credentials });

// ── S3 ───────────────────────────────────────────────────────────────────

async function ensureBucket(bucket) {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }));
    console.log(`[ok] bucket exists: ${bucket}`);
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }));
    console.log(`[ok] bucket created: ${bucket}`);
  }
}

async function ensureBucketCors(bucket) {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [{
          AllowedHeaders: ["*"],
          AllowedMethods: corsMethods,
          AllowedOrigins: corsOrigins,
          ExposeHeaders:  ["ETag", "Content-Length", "Content-Type"],
          MaxAgeSeconds:  3000,
        }],
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
  await s3.send(new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Sid: "PublicRead", Effect: "Allow", Principal: "*",
        Action: ["s3:GetObject"], Resource: `arn:aws:s3:::${bucket}/*`,
      }],
    }),
  }));
  console.log(`[ok] ${label} public-read policy configured: ${bucket}`);
}

async function ensureDevOpenAccess(bucket) {
  if (!devOpenAccess) {
    console.log(`[skip] dev open-access disabled: ${bucket}`);
    return;
  }
  await s3.send(new PutBucketPolicyCommand({
    Bucket: bucket,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "DevOpenBucket", Effect: "Allow", Principal: "*",
          Action: ["s3:ListBucket", "s3:GetBucketLocation", "s3:ListBucketMultipartUploads"],
          Resource: `arn:aws:s3:::${bucket}`,
        },
        {
          Sid: "DevOpenObjects", Effect: "Allow", Principal: "*",
          Action: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject",
                   "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
          Resource: `arn:aws:s3:::${bucket}/*`,
        },
      ],
    }),
  }));
  console.log(`[ok] dev open-access policy configured: ${bucket}`);
}

// ── IAM ──────────────────────────────────────────────────────────────────

async function ensureIamRole(roleName, services) {
  try {
    await iam.send(new GetRoleCommand({ RoleName: roleName }));
    console.log(`[ok] iam role exists: ${roleName}`);
    return;
  } catch { /* 不存在，继续创建 */ }
  await iam.send(new CreateRoleCommand({
    RoleName: roleName,
    AssumeRolePolicyDocument: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Principal: { Service: services }, Action: "sts:AssumeRole" }],
    }),
  }));
  console.log(`[ok] iam role created: ${roleName}`);
}

// ── EventBridge ───────────────────────────────────────────────────────────

async function ensureEventBus(name) {
  try {
    await eb.send(new DescribeEventBusCommand({ Name: name }));
    console.log(`[ok] event bus exists: ${name}`);
    return;
  } catch { /* 不存在，继续创建 */ }
  await eb.send(new CreateEventBusCommand({ Name: name }));
  console.log(`[ok] event bus created: ${name}`);
}

// ── 子进程（deploy 脚本）──────────────────────────────────────────────────

function runScript(script) {
  return new Promise((resolve_, reject) => {
    const child = spawn(process.execPath, [script], {
      stdio: "inherit",
      env:   process.env,
      shell: false,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve_(undefined);
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

// ── 主流程 ────────────────────────────────────────────────────────────────

async function main() {
  // ── 步骤 1：基础设施初始化 ──────────────────────────────────────────────
  const sep = "─".repeat(60);
  console.log(`\n${sep}\n▶  bootstrap (S3 + IAM + EventBridge)\n${sep}`);

  for (const bucket of [rawBucket, hlsBucket, imageBucket]) {
    await ensureBucket(bucket);
    await ensureBucketCors(bucket);
    await ensureDevOpenAccess(bucket);
  }
  await ensurePublicRead(hlsBucket,   hlsPublicRead,   "hls");
  await ensurePublicRead(imageBucket, imagePublicRead, "image");

  await ensureIamRole("lambda-role", ["lambda.amazonaws.com"]);
  await ensureIamRole("sfn-role",    ["states.amazonaws.com"]);

  await ensureEventBus(eventBusName);

  // ── 步骤 2 & 3：部署 Lambda 与状态机 ───────────────────────────────────
  for (const [label, script] of [
    ["deploy-lambdas", resolve(here, "deploy-lambdas.mjs")],
    ["deploy-sfn",     resolve(here, "deploy-sfn.mjs")],
  ]) {
    console.log(`\n${sep}\n▶  ${label}\n${sep}`);
    await runScript(script);
  }

  console.log("\n✓ localstack:setup 完成");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
