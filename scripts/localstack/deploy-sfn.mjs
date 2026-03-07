/**
 * deploy-sfn.mjs
 *
 * 创建或更新 LocalStack Step Functions 状态机。
 *
 * 流程为：ExtractMetadata -> Transcode -> Finalize，
 * 任一步骤失败时通过 Catch 分支路由到 MarkFailed。
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

// ── ASL 定义构建 ─────────────────────────────────────────────────────────

function buildDefinition(arns) {
  // Route any task failure to MarkFailed while preserving state input.
  const catchToMarkFailed = [
    {
      ErrorEquals: ["States.ALL"],
      Next:        "MarkFailed",
      ResultPath:  "$.errorInfo",
    },
  ];

  return {
    Comment: "VOD transcode pipeline: ExtractMetadata -> Transcode -> Finalize",
    StartAt: "ExtractMetadata",
    States:  {
      ExtractMetadata: {
        Type:       "Task",
        Resource:   arns["extract-metadata"],
        Comment:    "Set TranscodeJob to RUNNING and Video to PROCESSING",
        ResultPath: null,   // Keep input shape unchanged for next step
        Next:       "Transcode",
        Catch:      catchToMarkFailed,
      },
      Transcode: {
        Type:     "Task",
        Resource: arns["transcode"],
        Comment:  "Download source video, transcode with ffmpeg, upload HLS",
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
        Comment:  "Write VideoAsset metadata and set READY",
        End:      true,
        Catch:    catchToMarkFailed,
      },
      MarkFailed: {
        Type:       "Task",
        Resource:   arns["mark-failed"],
        Comment:    "Set job and video to FAILED",
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

// Main flow

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
