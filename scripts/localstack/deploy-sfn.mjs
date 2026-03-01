/**
 * deploy-sfn.mjs
 *
 * 读取 .lambda-arns.json，渲染 ASL 状态机定义，
 * 在 LocalStack 中创建或更新 Standard Workflow 状态机。
 *
 * 成功后将状态机 ARN 追加写入 .sfn-arn.txt（方便 .env.local 配置）。
 *
 * 状态机流程：
 *   ExtractMetadata → Transcode (Retry×3) → Finalize
 *         │                │                     │
 *         └────────────────┴──── Catch ──→ MarkFailed
 */

import {
  SFNClient,
  CreateStateMachineCommand,
  UpdateStateMachineCommand,
  ListStateMachinesCommand,
} from "@aws-sdk/client-sfn";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

// ── 配置 ─────────────────────────────────────────────────────────────────

const region       = process.env.AWS_DEFAULT_REGION  ?? "us-east-1";
const endpoint     = process.env.LOCALSTACK_ENDPOINT ?? "http://127.0.0.1:4566";
const accountId    = process.env.AWS_ACCOUNT_ID      ?? "000000000000";
const smName       = process.env.VOD_SFN_NAME        ?? "vod-transcode";

const arnFile    = resolve(import.meta.dirname, ".lambda-arns.json");
const arnOutFile = resolve(import.meta.dirname, ".sfn-arn.txt");

const sfn = new SFNClient({
  region,
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

// ── ASL 定义构建 ─────────────────────────────────────────────────────────

function buildDefinition(arns) {
  /**
   * MarkFailed 需要原始的 jobId/videoId（来自 execution input），
   * 以及 Step Functions 捕获的 Error/Cause。
   *
   * Catch 使用 ResultPath: "$.errorInfo"，Step Functions 将错误信息
   * 写入 $.errorInfo.Error 和 $.errorInfo.Cause，原始输入字段保留在根层。
   * Parameters 必须从 $.errorInfo.Error/Cause 读取，而非 $.Error/$.Cause，
   * 否则 Step Functions 会抛出 NoSuchJsonPathError（根节点不存在该字段）。
   */
  const markFailedParams = {
    "jobId.$":   "$$.Execution.Input.jobId",
    "videoId.$": "$$.Execution.Input.videoId",
    "error.$":   "$.errorInfo.Error",
    "cause.$":   "$.errorInfo.Cause",
  };

  const catchToMarkFailed = [
    {
      ErrorEquals: ["States.ALL"],
      Next:        "MarkFailed",
      ResultPath:  "$.errorInfo",
    },
  ];

  return {
    Comment: "VOD 视频转码管道 — ExtractMetadata → Transcode → Finalize",
    StartAt: "ExtractMetadata",
    States:  {
      ExtractMetadata: {
        Type:       "Task",
        Resource:   arns["extract-metadata"],
        Comment:    "标记任务为 RUNNING，视频为 PROCESSING",
        ResultPath: null,   // 输入原样透传给下一步
        Next:       "Transcode",
        Catch:      catchToMarkFailed,
      },
      Transcode: {
        Type:     "Task",
        Resource: arns["transcode"],
        Comment:  "下载源视频，ffmpeg 转码，上传 HLS",
        Retry: [
          {
            ErrorEquals:     ["States.TaskFailed"],
            IntervalSeconds: 10,
            MaxAttempts:     3,
            BackoffRate:     2.0,
          },
        ],
        Next:  "Finalize",
        Catch: catchToMarkFailed,
      },
      Finalize: {
        Type:     "Task",
        Resource: arns["finalize"],
        Comment:  "写入 VideoAsset，标记 READY",
        End:      true,
        Catch:    catchToMarkFailed,
      },
      MarkFailed: {
        Type:       "Task",
        Resource:   arns["mark-failed"],
        Comment:    "标记任务和视频为 FAILED",
        Parameters: markFailedParams,
        End:        true,
      },
    },
  };
}

// ── 查找已存在的状态机 ARN ───────────────────────────────────────────────

async function findExistingArn(name) {
  let nextToken;
  do {
    const res = await sfn.send(
      new ListStateMachinesCommand({ nextToken, maxResults: 100 }),
    );
    const found = res.stateMachines?.find((sm) => sm.name === name);
    if (found) return found.stateMachineArn ?? null;
    nextToken = res.nextToken;
  } while (nextToken);
  return null;
}

// ── 主流程 ──────────────────────────────────────────────────────────────

async function main() {
  // 读取各 Lambda ARN
  let arns;
  try {
    arns = JSON.parse(await readFile(arnFile, "utf8"));
  } catch {
    throw new Error(
      ".lambda-arns.json 不存在，请先运行 npm run localstack:deploy-lambda",
    );
  }

  const required = ["extract-metadata", "transcode", "finalize", "mark-failed"];
  for (const key of required) {
    if (!arns[key]) {
      throw new Error(`缺少 Lambda ARN: ${key}，请先运行 deploy-lambdas.mjs`);
    }
  }

  const definition = JSON.stringify(buildDefinition(arns));
  const roleArn    = `arn:aws:iam::${accountId}:role/sfn-role`;

  const existingArn = await findExistingArn(smName);

  let stateMachineArn;
  if (existingArn) {
    console.log(`[update] 状态机 ${smName}`);
    await sfn.send(
      new UpdateStateMachineCommand({
        stateMachineArn: existingArn,
        definition,
      }),
    );
    stateMachineArn = existingArn;
  } else {
    console.log(`[create] 状态机 ${smName}`);
    const res = await sfn.send(
      new CreateStateMachineCommand({
        name:           smName,
        definition,
        roleArn,
        type:           "STANDARD",
        loggingConfiguration: { level: "OFF" },
      }),
    );
    stateMachineArn = res.stateMachineArn ?? "";
  }

  console.log(`[ok] stateMachineArn=${stateMachineArn}`);

  // 写出 ARN 文件，方便复制到 .env.local
  await writeFile(arnOutFile, stateMachineArn);
  console.log(`\n请将以下内容添加到 .env.local：`);
  console.log(`VOD_SFN_STATE_MACHINE_ARN=${stateMachineArn}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
