/**
 * deploy-sfn.mjs
 *
 * 创建或更新 LocalStack Step Functions 状态机。
 *
 * 状态机包含四个阶段：
 * 1. ExtractMetadata：标记任务开始，并让视频进入 PROCESSING。
 * 2. Transcode：下载源视频，生成 HLS 播放资源和封面。
 * 3. Finalize：把播放资源写回数据库，并把视频置为 READY。
 * 4. MarkFailed：记录失败原因，供前端展示和后续重试。
 *
 * 前三步是主路径；任一步失败都会通过 Catch 进入 MarkFailed。
 */

import {
  SFNClient,
  CreateStateMachineCommand,
  UpdateStateMachineCommand,
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
} from "@aws-sdk/client-sfn";
import { LambdaClient, GetFunctionCommand } from "@aws-sdk/client-lambda";

// ── 配置 ─────────────────────────────────────────────────────────────────

const region       = process.env.AWS_DEFAULT_REGION  ?? "us-east-1";
const endpoint     = process.env.LOCALSTACK_ENDPOINT ?? "http://localhost:4566";
const accountId    = process.env.AWS_ACCOUNT_ID      ?? "000000000000";
const smName       = process.env.VOD_SFN_NAME        ?? "vod-transcode";

const sfn = new SFNClient({
  region,
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

const lambda = new LambdaClient({
  region,
  endpoint,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID     ?? "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "test",
  },
});

// ── 状态机定义构建 ───────────────────────────────────────────────────────

function buildDefinition(arns) {
  // Catch 将失败信息写入 $.errorInfo，并保留原始 jobId/videoId 等输入。
  const catchToMarkFailed = [
    {
      ErrorEquals: ["States.ALL"],
      Next:        "MarkFailed",
      ResultPath:  "$.errorInfo",
    },
  ];

  return {
    Comment: "视频处理流水线：元数据登记 -> 转码切片 -> 结果入库 -> 失败处理",
    StartAt: "ExtractMetadata",
    States:  {
      ExtractMetadata: {
        Type:       "Task",
        Resource:   arns["extract-metadata"],
        Comment:    "登记处理开始：TranscodeJob 置为 RUNNING，Video 置为 PROCESSING",
        ResultPath: null,   // 这一步只改数据库，不改传给下一步的输入结构。
        Next:       "Transcode",
        Catch:      catchToMarkFailed,
      },
      Transcode: {
        Type:     "Task",
        Resource: arns["transcode"],
        Comment:  "执行媒体处理：下载源视频，用 ffmpeg 生成 HLS 切片和封面",
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
        Comment:  "结果入库：写入 VideoAsset，并把视频标记为 READY",
        End:      true,
        Catch:    catchToMarkFailed,
      },
      MarkFailed: {
        Type:       "Task",
        Resource:   arns["mark-failed"],
        Comment:    "失败处理：记录错误原因，并把任务和视频标记为 FAILED",
        Retry: [
          {
            ErrorEquals:     ["States.ALL"],
            IntervalSeconds: 3,
            MaxAttempts:     5,
            BackoffRate:     2.0,
          },
        ],
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

function lambdaArnFor(suffix) {
  return `arn:aws:lambda:${region}:${accountId}:function:vod-${suffix}`;
}

function normalizeJsonString(text) {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

async function assertFunctionExists(functionName) {
  try {
    await lambda.send(new GetFunctionCommand({ FunctionName: functionName }));
  } catch {
    throw new Error(`Missing Lambda: ${functionName}, run npm run localstack:deploy-lambda first`);
  }
}

async function buildLambdaArnMap() {
  const mapping = {
    "extract-metadata": "extract-metadata",
    transcode: "transcode",
    finalize: "finalize",
    "mark-failed": "mark-failed",
  };

  for (const suffix of Object.values(mapping)) {
    await assertFunctionExists(`vod-${suffix}`);
  }

  return {
    "extract-metadata": lambdaArnFor(mapping["extract-metadata"]),
    transcode: lambdaArnFor(mapping.transcode),
    finalize: lambdaArnFor(mapping.finalize),
    "mark-failed": lambdaArnFor(mapping["mark-failed"]),
  };
}

// ── 主流程：校验 Lambda、创建或更新状态机 ─────────────────────────────────

async function main() {
  const startedAt = Date.now();
  const arns = await buildLambdaArnMap();

  const definition = JSON.stringify(buildDefinition(arns));
  const roleArn    = `arn:aws:iam::${accountId}:role/sfn-role`;

  const existingArn = await findExistingArn(smName);

  let stateMachineArn;
  if (existingArn) {
    console.log(`[update] state machine ${smName}`);
    const current = await sfn.send(
      new DescribeStateMachineCommand({ stateMachineArn: existingArn }),
    );
    const currentDefinition = current.definition ?? "";

    if (normalizeJsonString(currentDefinition) === normalizeJsonString(definition)) {
      console.log(`[skip] state machine definition unchanged: ${smName}`);
    } else {
      await sfn.send(
        new UpdateStateMachineCommand({
          stateMachineArn: existingArn,
          definition,
        }),
      );
    }
    stateMachineArn = existingArn;
  } else {
    console.log(`[create] state machine ${smName}`);
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
  console.log(`[timing] deploy-sfn duration=${Date.now() - startedAt}ms`);
  console.log("\nAdd this to .env.local:");
  console.log(`VOD_SFN_STATE_MACHINE_ARN=${stateMachineArn}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
